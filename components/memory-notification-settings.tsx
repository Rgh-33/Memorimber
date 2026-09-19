"use client";

import { useEffect, useState } from "react";
import { disableMemoryPush, enableMemoryPush, getLocalPushSubscription, notificationSupport, pushSubscriptionRequest } from "@/lib/push-client";
import { defaultNotificationPreferences, parseNotificationPreferences, type NotificationPreferences } from "@/lib/notification-preferences";

type Status = "未設定" | "有効" | "拒否" | "非対応" | "確認できません";
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const buttonClass = "min-h-11 rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-50";

export function MemoryNotificationSettings() {
  const [status, setStatus] = useState<Status>("未設定");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feedbackArea, setFeedbackArea] = useState<"registration" | "preferences" | "test">("registration");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [draft, setDraft] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [saved, setSaved] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [inspection, setInspection] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let active = true;
    const inspect = async () => {
      setBusy(true); setError(""); setMessage(""); setFeedbackArea("registration");
      if (!notificationSupport() || !("PushManager" in window)) { if (active) setStatus("非対応"); return; }
      const subscription = await getLocalPushSubscription();
      if (!active) return;
      setEndpoint(subscription?.endpoint ?? null);
      setStatus(Notification.permission === "denied" ? "拒否" : "未設定");
      if (!subscription || Notification.permission !== "granted") return;
      const result = await pushSubscriptionRequest("PATCH", { endpoint: subscription.endpoint });
      if (!active) return;
      if (result.enabled) {
        const preferences = parseNotificationPreferences(result.preferences);
        if (!preferences) throw new Error("Invalid preferences");
        setDraft(preferences); setSaved(preferences); setStatus("有効");
      }
    };
    void inspect().catch(() => {
      if (active) { setStatus("確認できません"); setError("通知設定を確認できませんでした。通信状態を確認して再試行してください。"); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [inspection]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const enable = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage(""); setFeedbackArea("registration");
    try {
      if (!publicKey) throw new Error("通知の配信設定が完了していません。管理者による設定が必要です。");
      const nextEndpoint = await enableMemoryPush(publicKey);
      setEndpoint(nextEndpoint);
      setDraft(defaultNotificationPreferences()); setSaved(defaultNotificationPreferences());
      setStatus("有効"); setMessage("この端末の通知を有効にしました。");
    } catch (cause) {
      setStatus(notificationSupport() && Notification.permission === "denied" ? "拒否" : "未設定");
      setError(cause instanceof Error ? cause.message : "通知を有効にできませんでした。");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true); setError(""); setMessage(""); setFeedbackArea("registration");
    try {
      // Retain the known server endpoint if the browser has already lost its subscription.
      if (endpoint) {
        await pushSubscriptionRequest("DELETE", { endpoint });
        setStatus(Notification.permission === "denied" ? "拒否" : "未設定");
      }
      await disableMemoryPush();
      setEndpoint(null); setDraft(defaultNotificationPreferences()); setSaved(defaultNotificationPreferences());
      setStatus(Notification.permission === "denied" ? "拒否" : "未設定");
      setMessage("この端末の通知を無効にしました。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "通知を無効にできませんでした。"); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (busy || !endpoint) return;
    setBusy(true); setError(""); setMessage(""); setFeedbackArea("preferences");
    try {
      const result = await pushSubscriptionRequest("PUT", { endpoint, preferences: draft });
      const preferences = parseNotificationPreferences(result.preferences);
      if (!preferences) throw new Error("保存結果を確認できませんでした。もう一度保存してください。");
      setDraft(preferences); setSaved(preferences); setMessage("この端末の通知設定を保存しました。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "通知設定を保存できませんでした。"); }
    finally { setBusy(false); }
  };

  const test = async () => {
    if (busy || !endpoint || cooldown > 0) return;
    setBusy(true); setError(""); setMessage(""); setFeedbackArea("test");
    try {
      const response = await fetch("/api/push-subscriptions/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint }),
      });
      const result = await response.json();
      if (typeof result.retryAfter === "number") setCooldown(Math.max(1, Math.ceil(result.retryAfter)));
      else if (response.ok || response.status === 502) setCooldown(60);
      if (result.expired) setStatus("未設定");
      if (!response.ok) throw new Error(result.error ?? "テスト通知を送信できませんでした。");
      setMessage("送信を受け付けました。端末の通知を確認してください。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "テスト通知を送信できませんでした。"); }
    finally { setBusy(false); }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const paused = (!draft.harvest_enabled && !draft.anniversary_enabled) || draft.weekdays.length === 0;
  const editable = status === "有効" && !busy;
  const feedback = <>
    {message && <p role="status" className="mt-3 text-sm leading-6">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm leading-6">{error}</p>}
  </>;

  return <div className="mt-7 space-y-4">
    <section className="settings-card" aria-labelledby="memory-notifications-heading">
      <h2 id="memory-notifications-heading" className="text-base font-semibold">この端末の通知設定</h2>
      <p className="mt-2 text-xs leading-6 text-ink/65">通知の種類と曜日は、端末ごとに設定できます。</p>
      <p className="mt-3 text-sm font-semibold" role="status">{busy ? "処理中…" : status}</p>
      {status === "有効" && <p className="mt-2 text-xs leading-6 text-ink/65">この端末の通知登録が完了しています。実際に届くかはテスト通知で確認できます。</p>}
      {status === "非対応" && <p className="mt-2 text-xs leading-6 text-ink/65">iPhoneではSafariの共有メニューから「ホーム画面に追加」し、追加したアプリから開いてください。</p>}
      {status === "拒否" && <p className="mt-2 text-xs leading-6 text-ink/65">iPhoneの「設定」→「通知」から、このアプリの通知を許可してください。他の端末ではブラウザまたは端末の通知設定を確認してください。</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {status === "未設定" && <button type="button" disabled={busy} onClick={() => void enable()} className={`${buttonClass} border-transparent bg-coral text-white`}>通知を有効にする</button>}
        {status !== "非対応" && (status === "有効" || endpoint) && <button type="button" disabled={busy} onClick={() => void disable()} className={buttonClass}>通知を無効にする</button>}
        {(status === "確認できません" || status === "拒否") && <button type="button" disabled={busy} onClick={() => setInspection((value) => value + 1)} className={buttonClass}>設定を再確認</button>}
      </div>
      {endpoint && <p className="mt-2 text-xs leading-6 text-ink/55">無効化すると、この端末の通知の種類と曜日も初期設定に戻ります。</p>}
      {feedbackArea === "registration" && feedback}
    </section>

    <section className="settings-card" aria-labelledby="notification-content-heading">
      <h2 id="notification-content-heading" className="text-base font-semibold">受け取る通知</h2>
      {status !== "有効" && <p className="mt-2 text-xs leading-6 text-ink/65">通知を有効にすると、種類と曜日を変更できます。</p>}
      <fieldset disabled={!editable} className="mt-4 space-y-4 disabled:opacity-50">
        <legend className="sr-only">通知の種類</legend>
        {([
          ["harvest_enabled", "収穫のお知らせ", "収穫できる木の実がある日にお知らせします。"],
          ["anniversary_enabled", "過去の思い出", "1〜3年前の同じ時期（前後7日）の思い出をお知らせします。"],
        ] as const).map(([key, label, description]) => <label key={key} className="flex min-h-11 items-start gap-3">
          <input type="checkbox" checked={draft[key]} onChange={(event) => { setDraft({ ...draft, [key]: event.target.checked }); setMessage(""); }} className="mt-1 h-5 w-5 shrink-0 accent-coral" />
          <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-6 text-ink/65">{description}</span></span>
        </label>)}
      </fieldset>
      <fieldset disabled={!editable} className="mt-5 disabled:opacity-50">
        <legend className="text-sm font-medium">受け取る曜日</legend>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {weekdays.map((label, day) => <button key={day} type="button" aria-label={`${label}曜日`} aria-pressed={draft.weekdays.includes(day)} onClick={() => {
            setDraft((value) => ({ ...value, weekdays: value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort((a, b) => a - b) }));
            setMessage("");
          }} className={`min-h-11 rounded-lg border text-sm ${draft.weekdays.includes(day) ? "border-coral bg-coral text-white" : "border-line bg-paper text-ink"}`}>{label}</button>)}
        </div>
        <p className="mt-2 text-xs leading-6 text-ink/55">曜日は日本時間で判定します。</p>
      </fieldset>
      {status === "有効" && <>
        {paused && <p className="mt-3 text-xs leading-6 text-ink/70">{dirty ? "この設定を保存すると、自動通知は届きません。" : "現在の設定では自動通知は届きません。"}</p>}
        <button type="button" disabled={!editable || !dirty} onClick={() => void save()} className={`${buttonClass} mt-4 border-transparent bg-coral text-white`}>保存する</button>
        {dirty && <p className="mt-2 text-xs text-ink/60">保存していない変更があります。</p>}
      </>}
      {feedbackArea === "preferences" && feedback}
    </section>

    <section className="settings-card" aria-labelledby="notification-test-heading">
      <h2 id="notification-test-heading" className="text-base font-semibold">通知が届くか確認</h2>
      <p className="mt-2 text-xs leading-6 text-ink/65">思い出の有無や選んだ曜日に関係なく、この端末へテスト通知を送ります。当日の自動通知には影響しません。</p>
      <button type="button" disabled={!editable || cooldown > 0} onClick={() => void test()} className={`${buttonClass} mt-3 w-full`}>{cooldown > 0 ? `あと${cooldown}秒で再送できます` : "この端末にテスト通知を送る"}</button>
      <p className="mt-2 text-xs leading-6 text-ink/55">テストは1分に1回までです。別の端末からのテストも含みます。</p>
      {feedbackArea === "test" && feedback}
    </section>

    <section className="settings-card" aria-labelledby="notification-schedule-heading">
      <h2 id="notification-schedule-heading" className="text-base font-semibold">届く時間について</h2>
      <p className="mt-2 text-xs leading-6 text-ink/65">選んだ曜日の日本時間20時台に配信予定です。対象となる思い出がある日に、1種類だけお知らせします。対象がない日は届きません。</p>
      <p className="mt-2 text-xs leading-6 text-ink/65">iPhoneではホーム画面に追加したアプリから通知を有効にしてください。届かないときは、端末の通知設定や集中モードも確認してください。</p>
    </section>
  </div>;
}
