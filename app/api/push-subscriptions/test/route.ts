import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validPushEndpoint } from "@/lib/push-subscription";
import { sendTestPush } from "@/lib/push-test";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return Response.json({ error: "ログインしてください。" }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "Invalid request" }, { status: 400 });
    let input;
    try { input = JSON.parse(raw); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    if (!validPushEndpoint(input?.endpoint)) return Response.json({ error: "Invalid endpoint" }, { status: 400 });
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject || !process.env.SUPABASE_SECRET_KEY) {
      return Response.json({ error: "通知の配信設定が完了していません。管理者による設定が必要です。" }, { status: 503 });
    }
    const result = await sendTestPush(client, createAdminClient(), user.id, input.endpoint, (subscription, payload) => webpush.sendNotification(subscription, payload, {
      vapidDetails: { publicKey, privateKey, subject }, timeout: 5000, TTL: 60, urgency: "high",
    }));
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if ("retryAfter" in result.body && result.body.retryAfter) headers["Retry-After"] = String(result.body.retryAfter);
    return Response.json(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: "通知設定を確認できませんでした。通信状態と通知用DB設定を確認してください。" }, { status: 503 });
  }
}
