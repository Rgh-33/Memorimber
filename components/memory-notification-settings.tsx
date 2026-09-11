"use client";

import { useEffect, useState } from "react";
import { disableMemoryPush, enableMemoryPush, notificationSupport, pushSubscriptionRequest } from "@/lib/push-client";

type Status = "未設定" | "有効" | "拒否" | "非対応";
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function MemoryNotificationSettings() {
  const [status, setStatus] = useState<Status>("未設定");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [hasLocalSubscription, setHasLocalSubscription] = useState(false);

  useEffect(() => {
    let active = true;
    const inspect = async () => {
      if (!notificationSupport() || !("PushManager" in window)) { if (active) setStatus("非対応"); return; }
      if (Notification.permission === "denied") { if (active) setStatus("拒否"); }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (active) setHasLocalSubscription(Boolean(subscription));
      if (!subscription || Notification.permission !== "granted") return;
      const result = await pushSubscriptionRequest("PATCH", { endpoint: subscription.endpoint });
      if (active) setStatus(result.enabled ? "有効" : "未設定");
    };
    void inspect().catch(() => { if (active) setMessage("通知設定を確認できませんでした。通信状態を確認し、再設定してください。"); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const enable = async () => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (!publicKey) throw new Error("定期通知の準備中です。通知テストは木のプレビューから利用できます。");
      await enableMemoryPush(publicKey);
      setHasLocalSubscription(true); setStatus("有効");
    } catch (cause) {
      setStatus(notificationSupport() && Notification.permission === "denied" ? "拒否" : "未設定");
      setMessage(cause instanceof Error ? cause.message : "通知を有効にできませんでした。");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMessage("");
    try {
      await disableMemoryPush();
      setHasLocalSubscription(false); setStatus(Notification.permission === "denied" ? "拒否" : "未設定");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "通知を無効にできませんでした。"); }
    finally { setBusy(false); }
  };

  return <section className="settings-card mt-7" aria-labelledby="memory-notifications-heading">
    <h2 id="memory-notifications-heading" className="text-base font-semibold">思い出の通知</h2>
    <p className="mt-2 text-xs leading-6 text-ink/65">毎日20時ごろ、収穫できる木の実や、1〜3年前のこの頃に残した思い出をお知らせします。振り返る思い出がある日に、1種類だけ届きます。</p>
    <p className="mt-3 text-sm" role="status">{busy ? "確認中…" : status}</p>
    {status === "非対応" && <p className="mt-2 text-xs leading-6 text-ink/65">iPhoneではSafariの共有メニューから「ホーム画面に追加」し、追加したアプリから開いてください。対応していない環境でも、思い出やクイズはそのまま使えます。</p>}
    {status === "拒否" && <p className="mt-2 text-xs leading-6 text-ink/65">ブラウザまたは端末の設定から通知を許可してください。</p>}
    {status !== "非対応" && <div className="mt-3 flex gap-2">
      {status !== "有効" && status !== "拒否" && <button type="button" disabled={busy} onClick={() => void enable()} className="rounded-lg bg-coral px-4 py-2 text-sm text-white disabled:opacity-50">通知を有効にする</button>}
      {(status === "有効" || hasLocalSubscription) && <button type="button" disabled={busy} onClick={() => void disable()} className="rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-50">通知を無効にする</button>}
    </div>}
    {message && <p role="alert" className="mt-3 text-xs leading-6 text-ink/70">{message}</p>}
  </section>;
}
