var CACHE_NAME = 'fam-v1';

var PRECACHE_URLS = [
  '/',
  '/pages/rooms',
  '/pages/rooms.html',
  '/pages/life',
  '/pages/life.html',
  '/pages/explore',
  '/pages/explore.html',
  '/pages/gallery',
  '/pages/gallery.html',
  '/pages/amenities',
  '/pages/amenities.html',
  '/pages/booking',
  '/pages/booking.html',
  '/pages/login',
  '/pages/login.html',
  '/pages/signup',
  '/pages/signup.html',
  '/css/style.css',
  '/css/scroll-story.css',
  '/css/transitions.css',
  '/js/animations.js',
  '/js/scroll-story.js',
  '/js/transitions.js',
  '/js/mountain-time.js',
  '/js/seasonal.js',
  '/js/shader.js',
  '/js/concierge.js',
  '/favicon.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        /* precache failed silently */
      });
    })
  );
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
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/assets/frames/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          return response || fetch(event.request).then(function(networkRes) {
            if (networkRes && networkRes.ok) {
              cache.put(event.request, networkRes.clone());
            }
            return networkRes;
          });
        });
      })
    );
    return;
  }

  if (url.pathname.match(/\.(css|js|jpg|jpeg|png|gif|svg|webp|woff2?|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request).then(function(networkRes) {
          return caches.open(CACHE_NAME).then(function(cache) {
            if (networkRes && networkRes.ok) {
              cache.put(event.request, networkRes.clone());
            }
            return networkRes;
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) return response;
      return fetch(event.request).then(function(networkRes) {
        return caches.open(CACHE_NAME).then(function(cache) {
          if (networkRes && networkRes.ok && networkRes.type === 'basic') {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        });
      }).catch(function() {
        return caches.match('/');
      });
    })
  );
});
