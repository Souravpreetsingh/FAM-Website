(function() {
  if (!('serviceWorker' in navigator)) return;

  var localHosts = ['localhost', '127.0.0.1', '::1'];
  var isLocal = localHosts.indexOf(window.location.hostname) !== -1;

  function clearLocalCaches() {
    var cacheCleanup = 'caches' in window
      ? caches.keys().then(function(names) {
          return Promise.all(names.map(function(name) { return caches.delete(name); }));
        })
      : Promise.resolve();

    var workerCleanup = navigator.serviceWorker.getRegistrations
      ? navigator.serviceWorker.getRegistrations().then(function(registrations) {
          return Promise.all(registrations.map(function(registration) {
            return registration.unregister();
          }));
        })
      : navigator.serviceWorker.getRegistration().then(function(registration) {
          return registration ? registration.unregister() : false;
        });

    return Promise.all([cacheCleanup, workerCleanup]).then(function() {
      if (!navigator.serviceWorker.controller) return;

      try {
        if (sessionStorage.getItem('fam-sw-local-cleared')) return;
        sessionStorage.setItem('fam-sw-local-cleared', 'true');
      } catch (e) {
        return;
      }

      window.location.reload();
    });
  }

  window.addEventListener('load', function() {
    if (isLocal) {
      clearLocalCaches().catch(function(e) {
        console.warn('[SW] Local cleanup failed:', e);
      });
      return;
    }

    /* Unregister any existing service worker and delete caches to avoid stale-content issues */
    if ('caches' in window) {
      caches.keys().then(function(names) {
        return Promise.all(names.map(function(name) { return caches.delete(name); }));
      }).catch(function(){});
    }
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    }).catch(function(){});
  });
})();
