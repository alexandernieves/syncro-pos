self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return undefined;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Syncro', body: 'Nueva notificación' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Syncro', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/syncro.png',
    badge: '/syncro.png',
    vibrate: [100, 50, 100],
    // The same notification arriving twice (push + open screen) replaces itself
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Syncro', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  const url = new URL(target, self.location.origin);

  event.waitUntil((async () => {
    // A link to another site opens in a new window
    if (url.origin !== self.location.origin) return clients.openWindow(url.href);
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Already on that screen: just bring it forward
    const exact = list.find((c) => new URL(c.url).pathname === url.pathname);
    if (exact) return exact.focus();
    // Syncro is open on another screen: take it there
    const any = list.find((c) => new URL(c.url).origin === self.location.origin);
    if (any) {
      await any.focus();
      if ('navigate' in any) return any.navigate(url.href).catch(() => clients.openWindow(url.href));
      return undefined;
    }
    return clients.openWindow(url.href);
  })());
});
