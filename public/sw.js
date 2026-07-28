var CACHE_NAME = 'fam-v3';

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
  '/pages/booking',
  '/pages/login',
  '/pages/login.html',
  '/pages/signup',
  '/pages/signup.html',
  '/css/style.css',
  '/css/scroll-story.css',
  '/css/transitions.css',
  '/js/animations.js',
  '/js/scroll-story.js',
  '/js/page-transitions.js',
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
  if (event.request.method !== 'GET') return;

  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request));
    return;
  }

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

  var isHtml = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').indexOf('text/html') !== -1;
  var isFreshAsset = url.pathname.match(/\.(css|js|json)$/);

  if (isHtml || isFreshAsset) {
    event.respondWith(
      fetch(event.request).then(function(networkRes) {
        return caches.open(CACHE_NAME).then(function(cache) {
          if (networkRes && networkRes.ok && networkRes.type === 'basic') {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        });
      }).catch(function() {
        return caches.match(event.request).then(function(response) {
          return response || caches.match('/');
        });
      })
    );
    return;
  }

  if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|woff2?|ico)$/)) {
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
    fetch(event.request).then(function(networkRes) {
      return caches.open(CACHE_NAME).then(function(cache) {
        if (networkRes && networkRes.ok && networkRes.type === 'basic') {
          cache.put(event.request, networkRes.clone());
        }
        return networkRes;
      });
    }).catch(function() {
      return caches.match(event.request).then(function(response) {
        if (response) return response;
        return caches.open(CACHE_NAME).then(function(cache) {
          return cache.match('/');
        });
      });
    })
  );
});
