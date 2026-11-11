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

// Where the API is (the pages tell it; kept in the cache so it survives the worker restarting)
const CONFIG = 'syncro-config';
self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'syncro-api' && typeof d.api === 'string') {
    event.waitUntil(caches.open(CONFIG).then((c) => c.put('/__api', new Response(d.api))));
  }
});
async function apiBase() {
  try {
    const r = await (await caches.open(CONFIG)).match('/__api');
    return r ? (await r.text()).replace(/\/+$/, '') : null;
  } catch (e) {
    return null;
  }
}

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

  const tasks = [self.registration.showNotification(data.title || 'Syncro', options)];
  // A support message reached this device: the sender sees the gray double check
  if (data.ack) {
    tasks.push(apiBase().then((base) => base && fetch(base + '/chat-delivery/' + encodeURIComponent(data.ack), { method: 'POST' })).catch(() => undefined));
  }
  event.waitUntil(Promise.all(tasks));
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
