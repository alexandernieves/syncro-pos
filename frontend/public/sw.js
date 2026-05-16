self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch with basic error handling to prevent "Uncaught in promise"
  event.respondWith(
    fetch(event.request).catch((error) => {
      // If it's an API call, we just let it fail so the app can catch it
      // Otherwise, we log it
      if (!event.request.url.includes('onrender.com') && !event.request.url.includes('/api/')) {
        console.error('[SW] Fetch failed:', event.request.url, error);
      }
      // Return a basic failure response that the app can handle
      throw error;
    })
  );
});
