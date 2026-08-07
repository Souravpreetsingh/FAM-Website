(function() {
  if (!('serviceWorker' in navigator)) return;

          var SW_VERSION = '24072808';

  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js?v=' + SW_VERSION).catch(function(e) {
      console.warn('[SW] Registration failed:', e);
    });

    navigator.serviceWorker.addEventListener('controllerchange', function() {
      try {
        var key = 'fam_sw_reloaded_' + SW_VERSION;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
      } catch (e) { /* ignore */ }
      window.location.reload();
    });
  });
})();
