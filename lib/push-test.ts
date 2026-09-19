import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushSender } from "./memory-reminder-runner";
import { parsePushSubscription } from "./push-subscription.ts";

export async function sendTestPush(client: SupabaseClient, admin: SupabaseClient, userId: string, endpoint: string, send: PushSender) {
  const missing = { status: 404, body: { error: "この端末の通知登録がありません。通知を有効にしてください。", expired: true } };
  const { data, error } = await client.from("push_subscriptions").select("id,endpoint,p256dh,auth")
    .eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (error) throw error;
  if (!data) return missing;
  const subscription = parsePushSubscription({ endpoint: data.endpoint, keys: { p256dh: data.p256dh, auth: data.auth } });
  if (!subscription) return { status: 409, body: { error: "通知登録を確認できません。無効にしてから再度有効にしてください。" } };
  const claim = await admin.rpc("claim_push_notification_test", { p_user_id: userId });
  if (claim.error) throw claim.error;
  if (!Number.isInteger(claim.data) || claim.data < 0) throw new Error("Invalid test claim");
  if (claim.data > 0) return { status: 429, body: { error: `あと${claim.data}秒後にお試しください。`, retryAfter: claim.data as number } };
  const active = await client.from("push_subscriptions").select("id").eq("user_id", userId).eq("id", data.id).maybeSingle();
  if (active.error) throw active.error;
  if (!active.data) return missing;
  try {
    await send(subscription, JSON.stringify({ title: "メモリンバーのテスト通知", body: "この端末で通知を受け取れました。", href: "/settings/notifications" }));
    return { status: 200, body: { ok: true } };
  } catch (cause) {
    const status = cause && typeof cause === "object" && "statusCode" in cause ? cause.statusCode : null;
    if (status === 404 || status === 410) {
      const removed = await client.from("push_subscriptions").delete().eq("user_id", userId).eq("id", data.id);
      if (removed.error) throw removed.error;
      return { status: 410, body: { error: "通知登録の有効期限が切れています。もう一度通知を有効にしてください。", expired: true } };
    }
    // Log only an HTTP status, never upstream error objects or device credentials.
    console.warn("Push test rejected", { statusCode: typeof status === "number" ? status : null });
    return { status: 502, body: { error: "通知を送信できませんでした。時間をおいて再試行してください。改善しない場合は配信設定の確認が必要です。" } };
  }
}
