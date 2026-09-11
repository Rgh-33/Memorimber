import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory } from "./types";
import type { MemoryFruits } from "./supabase/memory-fruits";
import { buildPersistedTreeItems } from "./tree-growth.ts";
import { reminderPayload, selectMemoryReminder } from "./memory-reminders.ts";
import { parsePushSubscription, type SavedPushSubscription } from "./push-subscription.ts";

type SubscriptionRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
export type PushSender = (subscription: SavedPushSubscription, payload: string) => Promise<unknown>;

export async function deliverUserReminder(client: SupabaseClient, userId: string, date: string, subscriptions: SubscriptionRow[], send: PushSender) {
  // Idempotency guard also avoids reloading private data on a retry.
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
  const reminder = selectMemoryReminder(userId, date, memories, buildPersistedTreeItems(memories, date, fruits));
  if (!reminder) return "empty";
  const claim = await client.from("memory_notification_deliveries").insert({
    user_id: userId, notification_date: date, notification_type: reminder.type, candidate_id: reminder.candidateId,
  });
  if (claim.error?.code === "23505") return "skipped";
  if (claim.error) throw claim.error;

  let sent = false;
  for (const row of subscriptions) {
    // Re-check existence immediately before sending, to honor logout/deletion.
    const active = await client.from("push_subscriptions").select("id").eq("id", row.id).eq("user_id", userId).maybeSingle();
    if (active.error || !active.data) continue;
    const subscription = parsePushSubscription({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });
    if (!subscription) continue;
    try {
      await send(subscription, JSON.stringify(reminderPayload(reminder)));
      sent = true;
    } catch (cause) {
      const status = cause && typeof cause === "object" && "statusCode" in cause ? cause.statusCode : null;
      if (status === 404 || status === 410) {
        await client.from("push_subscriptions").delete().eq("id", row.id).eq("user_id", userId);
      }
      // Do not log endpoints, keys, payloads, or upstream error objects.
    }
  }
  const completed = await client.from("memory_notification_deliveries").update({ status: sent ? "sent" : "failed", sent_at: sent ? new Date().toISOString() : null }).eq("user_id", userId).eq("notification_date", date);
  if (completed.error) throw completed.error;
  return sent ? "sent" : "failed";
}

export async function runMemoryReminders(client: SupabaseClient, date: string, send: PushSender) {
  const subscriptions: SubscriptionRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").order("id").range(offset, offset + 499);
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
