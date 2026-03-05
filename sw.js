const CACHE_NAME = 'tasks-pro-cache-v6';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/badge-96.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', networkResponse.clone());
        return networkResponse;
      } catch (error) {
        return caches.match('./index.html');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'TASKS Pro';
  const options = {
    body: payload.body || 'Tienes una nueva notificación',
    icon: payload.icon || './icons/icon-192.png',
    badge: payload.badge || './icons/badge-96.png',
    tag: payload.tag || 'tasks-pro-push',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || './'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || './';

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        if ('navigate' in client) {
          await client.navigate(targetUrl);
        }
        client.focus();
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SHOW_LOCAL_NOTIFICATION') return;

  const payload = event.data.payload || {};
  self.registration.showNotification(payload.title || 'TASKS Pro', {
    body: payload.body || 'Notificación de prueba',
    icon: payload.icon || './icons/icon-192.png',
    badge: payload.badge || './icons/badge-96.png',
    tag: payload.tag || 'tasks-pro-local-test',
    data: { url: payload.url || './' }
  });
});
