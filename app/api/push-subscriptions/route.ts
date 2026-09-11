import { createClient } from "@/lib/supabase/server";
import { parsePushSubscription, validPushEndpoint } from "@/lib/push-subscription";

export const dynamic = "force-dynamic";

async function handle(request: Request, mode: "save" | "delete" | "status") {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return Response.json({ error: "ログインしてください。" }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "Invalid subscription" }, { status: 400 });
    const input = JSON.parse(raw);
    if (mode === "save") {
      const subscription = parsePushSubscription(input);
      if (!subscription) return Response.json({ error: "Invalid subscription" }, { status: 400 });
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
        return Response.json({ error: "定期通知のサーバー設定が完了していません。" }, { status: 503 });
      }
      const { error } = await client.from("push_subscriptions").upsert({
        user_id: user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth, updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
    } else {
      if (!validPushEndpoint(input?.endpoint)) return Response.json({ error: "Invalid endpoint" }, { status: 400 });
      if (mode === "status") {
        const { data, error } = await client.from("push_subscriptions").select("id").eq("user_id", user.id).eq("endpoint", input.endpoint).maybeSingle();
        if (error) throw error;
        return Response.json({ enabled: Boolean(data) }, { headers: { "Cache-Control": "no-store" } });
      }
      const { error } = await client.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", input.endpoint);
      if (error) throw error;
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "通知設定を保存・確認できませんでした。通信状態と通知用DB設定を確認してください。" }, { status: 503 });
  }
}

export function POST(request: Request) { return handle(request, "save"); }
export function DELETE(request: Request) { return handle(request, "delete"); }
export function PATCH(request: Request) { return handle(request, "status"); }
