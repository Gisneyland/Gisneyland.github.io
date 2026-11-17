---
layout: null
---
{% include asset-version.html %}
const CACHE = 'gisneyland-{{ asset_v }}';
const OFFLINE_URL = '{{ "/offline.html" | relative_url }}';
const PRECACHE = [
  OFFLINE_URL,
  '{{ "/assets/images/icon-192.png" | relative_url }}'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only same-origin GET requests are handled; Supabase, CDNs and form posts
// go straight to the network so staff and screening data is never stale or cached.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (/\.(?:css|js|png|ico|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            return caches.open(CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {})
              .then(() => response);
          }
          return response;
        });
        event.waitUntil(network.catch(() => {}));
        return cached || network;
      })
    );
  }
});
