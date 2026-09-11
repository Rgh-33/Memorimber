export type SavedPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com"
        || host === "web.push.apple.com" || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com"));
  } catch { return false; }
}

export function parsePushSubscription(value: unknown): SavedPushSubscription | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SavedPushSubscription>;
  if (!validPushEndpoint(candidate.endpoint) || !candidate.keys) return null;
  const { p256dh, auth } = candidate.keys;
  if (typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{87}=?$/.test(p256dh)
    || typeof auth !== "string" || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) return null;
  return { endpoint: candidate.endpoint, keys: { p256dh, auth } };
}
