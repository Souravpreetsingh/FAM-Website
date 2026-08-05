var CACHE_NAME = 'fam-v7';

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
      fetch(event.request).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(function(networkRes) {
      if (networkRes.status === 206) return networkRes;
      var clone = networkRes.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        if (networkRes && networkRes.ok && networkRes.type === 'basic') {
          cache.put(event.request, clone);
        }
      });
      return networkRes;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        return cached || caches.match('/');
      });
    })
  );
});
