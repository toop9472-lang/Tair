// طير — Push Service Worker
// Handles incoming Web Push notifications and click-to-focus behaviour.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "طير", body: "لديك تنبيه جديد", data: {}, url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    try {
      payload.body = event.data ? event.data.text() : payload.body;
    } catch (_) {}
  }

  const title = payload.title || "طير";
  const options = {
    body: payload.body || "",
    icon: "/tair_logo.png",
    badge: "/tair_logo.png",
    dir: "rtl",
    lang: "ar",
    vibrate: [80, 40, 80],
    data: { url: payload.url || "/", ...payload.data },
    tag: (payload.data && payload.data.tag) || undefined,
    renotify: !!(payload.data && payload.data.renotify),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing tab
      for (const c of clientList) {
        try {
          if ("focus" in c) {
            c.focus();
            if ("navigate" in c && targetUrl) c.navigate(targetUrl);
            return;
          }
        } catch (e) {}
      }
      // Otherwise open new window
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
