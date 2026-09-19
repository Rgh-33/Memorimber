import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { reminderDate } from "@/lib/memory-reminders";
import { runMemoryReminders } from "@/lib/memory-reminder-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const date = reminderDate();
  if (!publicKey || !privateKey || !subject) {
    console.warn("Memory reminders", { date, result: "not_configured" });
    return Response.json({ error: "Push is not configured" }, { status: 503 });
  }
  try {
    const counts = await runMemoryReminders(createAdminClient(), date, (subscription, payload) => webpush.sendNotification(subscription, payload, {
      vapidDetails: { subject, publicKey, privateKey }, timeout: 5000,
      TTL: 3600, topic: `memory-${date}`, urgency: "normal",
    }));
    // Aggregate counts only: never include credentials, payloads or user IDs.
    console.info("Memory reminders", { date, ...counts });
    return Response.json({ ok: true, ...counts });
  } catch {
    console.error("Memory reminders", { date, result: "failed" });
    return Response.json({ error: "Reminders could not be processed" }, { status: 500 });
  }
}
