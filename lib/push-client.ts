import type { Reminder } from "./memory-reminders";

export function notificationSupport() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "Notification" in window;
}

export async function registerNotificationWorker() {
  if (!notificationSupport()) throw new Error("この環境は通知に対応していません。iPhoneではSafariの共有から「ホーム画面に追加」し、追加したアプリから開いてください。");
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if (registration.active) return registration;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("通知の準備が間に合いませんでした。もう一度お試しください。")), 10000)),
  ]);
}

// Call directly from a click handler, before awaits, to preserve iOS activation.
export async function requestNotificationPermission() {
  if (!notificationSupport()) throw new Error("この環境は通知に対応していません。iPhoneではホーム画面に追加したアプリからお試しください。");
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error(permission === "denied"
    ? "通知が拒否されています。ブラウザまたは端末の設定から通知を許可してください。"
    : "通知は許可されませんでした。必要なときにもう一度お試しください。");
}

export async function pushSubscriptionRequest(method: "POST" | "DELETE" | "PATCH", value: unknown) {
  const response = await fetch("/api/push-subscriptions", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "通知設定を保存できませんでした。");
  return result as { enabled?: boolean };
}

export async function unsubscribeLocalPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  if ("pushManager" in registration) {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && !await subscription.unsubscribe()) throw new Error("端末の通知を解除できませんでした。");
  }
  const notifications = await registration.getNotifications();
  notifications.forEach((notification) => notification.close());
}

export async function enableMemoryPush(publicKey: string) {
  await requestNotificationPermission();
  const registration = await registerNotificationWorker();
  const previous = await registration.pushManager.getSubscription();
  if (previous) {
    if (!await previous.unsubscribe()) throw new Error("以前の通知設定を解除できませんでした。");
    await pushSubscriptionRequest("DELETE", { endpoint: previous.endpoint });
  }
  const decoded = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
  const key = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try { await pushSubscriptionRequest("POST", subscription.toJSON()); }
  catch (cause) { await subscription.unsubscribe().catch(() => false); throw cause; }
}

export async function disableMemoryPush() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const results = await Promise.allSettled([
      pushSubscriptionRequest("DELETE", { endpoint: subscription.endpoint }),
      subscription.unsubscribe(),
    ]);
    if (results[0].status === "rejected") throw results[0].reason;
    if (results[1].status === "rejected" || !results[1].value) throw new Error("定期配信は停止しました。端末の通知解除を再試行してください。");
  }
  (await registration?.getNotifications())?.forEach((notification) => notification.close());
}

export async function showPreviewReminder(reminder: Reminder) {
  await requestNotificationPermission();
  const registration = await registerNotificationWorker();
  await registration.showNotification(reminder.title, {
    body: reminder.body, icon: "/pwa/icon-192.png", tag: "memorimber-preview",
    data: { href: reminder.href },
  });
}
