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
  let data = { title: 'Syncro POS', body: 'Nueva notificación' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Syncro POS', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/syncro.png',
    badge: '/syncro.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard/soporte'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard/soporte';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
