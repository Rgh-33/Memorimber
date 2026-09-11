/* Notification-only worker. No fetch handler or offline/image cache. */
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

function safeHref(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/";
  const url = new URL(value, self.location.origin);
  return url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/";
}

self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (!payload || typeof payload.title !== "string" || typeof payload.body !== "string") return;
  event.waitUntil(self.registration.showNotification(payload.title.slice(0, 80), {
    body: payload.body.slice(0, 200), icon: "/pwa/icon-192.png", badge: "/pwa/icon-192.png",
    data: { href: safeHref(payload.href) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = safeHref(event.notification.data?.href);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        const navigated = await client.navigate(href);
        if (navigated) { await navigated.focus(); return; }
      } catch { /* Try another window, then open one. */ }
    }
    await self.clients.openWindow(href);
  })());
});
