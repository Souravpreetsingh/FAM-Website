var CACHE_NAME = 'fam-v4';

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

  event.respondWith(
    fetch(event.request).then(function(networkRes) {
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
