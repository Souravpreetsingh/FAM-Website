var CACHE_NAME = 'fam-v26090501';

function offlineFallback() {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title>' +
    '<style>body{font-family:Inter,Arial,sans-serif;background:#f8f4ec;color:#1a1c1a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>' +
    '</head><body><h1>You seem to be offline</h1></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function fromCache(request) {
  return caches.match(request).then(function (cached) {
    return cached || caches.match('/').then(function (home) {
      return home || offlineFallback();
    });
  });
}

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.map(function(name) {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function(networkRes) {
        if (networkRes.status >= 500) {
          return fromCache(event.request);
        }
        return networkRes;
      }).catch(function() {
        return fromCache(event.request);
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(function(networkRes) {
      if (networkRes.status === 206) return networkRes;
      // Skip caching large media files — they stream better from the network
      var ext = url.pathname.split('.').pop().toLowerCase();
      if (ext === 'mp4' || ext === 'webm' || ext === 'ogg') return networkRes;
      var clone = networkRes.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        if (networkRes && networkRes.ok && networkRes.type === 'basic') {
          cache.put(event.request, clone);
        }
      });
      return networkRes;
    }).catch(function() {
      return fromCache(event.request);
    })
  );
});
