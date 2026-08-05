(function() {
  if (!('serviceWorker' in navigator)) return;

  var SW_VERSION = '24072804';

  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js?v=' + SW_VERSION).catch(function(e) {
      console.warn('[SW] Registration failed:', e);
    });

    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
  });
})();
