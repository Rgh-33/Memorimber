import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory } from "./types";
import type { MemoryFruits } from "./supabase/memory-fruits";
import { buildPersistedTreeItems } from "./tree-growth.ts";
import { reminderPayload, selectMemoryReminder } from "./memory-reminders.ts";
import { parsePushSubscription, type SavedPushSubscription } from "./push-subscription.ts";
import { parseNotificationPreferences, receivesRemindersOn } from "./notification-preferences.ts";

type SubscriptionRow = { id: string; user_id: string };
export type PushSender = (subscription: SavedPushSubscription, payload: string) => Promise<unknown>;

export async function deliverUserReminder(client: SupabaseClient, userId: string, date: string, subscriptions: SubscriptionRow[], send: PushSender) {
  // Honor legacy user/day claims when rolling out per-device delivery records.
  const previous = await client.from("memory_notification_deliveries").select("user_id").eq("user_id", userId).eq("notification_date", date).maybeSingle();
  if (previous.error) throw previous.error;
  if (previous.data) return "skipped";
  const memories: Memory[] = [];
  const fruits: MemoryFruits = {};
  for (let offset = 0; ; offset += 500) {
    const result = await client.from("memories").select("id,memory_date,created_at").eq("user_id", userId).order("id").range(offset, offset + 499);
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    memories.push(...rows.map((row) => ({ id: row.id, date: row.memory_date, createdAt: row.created_at, caption: "", imageUrl: "", people: [], tags: [] })));
    if (rows.length) {
      // Query only IDs from this user's own memories; never load other owners.
      const result = await client.from("memory_fruits").select("memory_id,ripened_at,harvested_at").in("memory_id", rows.map((row) => row.id));
      if (result.error) throw result.error;
      for (const row of result.data ?? []) fruits[row.memory_id] = {
        memoryId: row.memory_id, ripenedAt: row.ripened_at, harvestedAt: row.harvested_at,
        isGolden: false, harvestWord: null, wordAssignedAt: null, homeVisibleUntil: null,
      };
    }
    if (rows.length < 500) break;
  }
  const items = buildPersistedTreeItems(memories, date, fruits);
  const outcomes: ("sent" | "failed" | "skipped" | "empty")[] = [];
  for (const row of subscriptions) {
    try {
      // Read fresh per-device settings so a change after the initial scan is honored.
      const active = await client.from("push_subscriptions").select("endpoint,p256dh,auth,harvest_enabled,anniversary_enabled,weekdays")
        .eq("id", row.id).eq("user_id", userId).maybeSingle();
      if (active.error) throw active.error;
      if (!active.data) { outcomes.push("skipped"); continue; }
      const preferences = parseNotificationPreferences(active.data);
      if (!preferences) throw new Error("Invalid notification preferences");
      if (!receivesRemindersOn(preferences, date)) { outcomes.push("skipped"); continue; }
      const reminder = selectMemoryReminder(userId, date, memories, items, preferences);
      if (!reminder) { outcomes.push("empty"); continue; }
      const subscription = parsePushSubscription({ endpoint: active.data.endpoint, keys: { p256dh: active.data.p256dh, auth: active.data.auth } });
      if (!subscription) throw new Error("Invalid push subscription");
      const claim = await client.from("push_notification_deliveries").insert({
        subscription_id: row.id, user_id: userId, notification_date: date,
        notification_type: reminder.type, candidate_id: reminder.candidateId,
      });
      if (claim.error?.code === "23505") { outcomes.push("skipped"); continue; }
      if (claim.error) throw claim.error;
      // Re-check immediately before sending, to honor logout/deletion.
      const present = await client.from("push_subscriptions").select("id").eq("id", row.id).eq("user_id", userId).maybeSingle();
      if (present.error) throw present.error;
      if (!present.data) { outcomes.push("skipped"); continue; }
      let sent = false;
      try {
        await send(subscription, JSON.stringify(reminderPayload(reminder)));
        sent = true;
      } catch (cause) {
        const status = cause && typeof cause === "object" && "statusCode" in cause ? cause.statusCode : null;
        if (status === 404 || status === 410) {
          const removed = await client.from("push_subscriptions").delete().eq("id", row.id).eq("user_id", userId);
          if (removed.error) throw removed.error;
        }
        // Do not log endpoints, keys, payloads, or upstream error objects.
      }
      const completed = await client.from("push_notification_deliveries")
        .update({ status: sent ? "sent" : "failed", sent_at: sent ? new Date().toISOString() : null })
        .eq("subscription_id", row.id).eq("notification_date", date);
      if (completed.error) throw completed.error;
      outcomes.push(sent ? "sent" : "failed");
    } catch {
      outcomes.push("failed");
    }
  }
  // Preserve the existing cron response: these counts describe users, not devices.
  return outcomes.includes("sent") ? "sent" : outcomes.includes("failed") ? "failed"
    : outcomes.includes("empty") ? "empty" : "skipped";
}

export async function runMemoryReminders(client: SupabaseClient, date: string, send: PushSender) {
  const subscriptions: SubscriptionRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client.from("push_subscriptions").select("id,user_id").order("id").range(offset, offset + 499);
    if (result.error) throw result.error;
    subscriptions.push(...(result.data ?? []));
    if ((result.data ?? []).length < 500) break;
  }
  const groups = new Map<string, SubscriptionRow[]>();
  for (const row of subscriptions) groups.set(row.user_id, [...(groups.get(row.user_id) ?? []), row]);
  const counts = { sent: 0, skipped: 0, empty: 0, failed: 0 };
  // Bounded concurrency; a slow/broken device must not block other users.
  const queue = [...groups];
  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      try { counts[await deliverUserReminder(client, entry[0], date, entry[1], send)]++; }
      catch { counts.failed++; }
    }
  }));
  return counts;
}
