(function () {
  'use strict';

  var EXIT_DURATION = 350;
  var ENTER_DURATION = 450;
  var BUSY = false;
  var overlay = document.getElementById('pt-overlay');

  var CURRENT_URL = window.location.href;
  var currentFetch = null;
  var navSequence = 0;

  function cleanup() {
    BUSY = false;
    if (overlay) {
      overlay.style.transition = 'none';
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
    }
    if (document.body) document.body.classList.remove('pt-exit');
  }

  function getPageName(url) {
    try {
      var path = new URL(url, window.location.origin).pathname;
      if (path === '/' || path === '/index.html') return 'home';
      var s = path.split('/').pop().replace('.html', '');
      return s || 'home';
    } catch (e) { return 'home'; }
  }

  // ── initial page setup ──
  try {
    (function initPage() {
      if (history.scrollRestoration) history.scrollRestoration = 'manual';
      var initialUrl = window.location.href;
      var page = getPageName(initialUrl);
      document.body.classList.add('pt-page-' + page);
      if (overlay) {
        overlay.style.transition = 'none';
        if (parseFloat(window.getComputedStyle(overlay).opacity) > 0.01) {
          overlay.style.opacity = '1';
        }
      }
      history.replaceState({ url: initialUrl, title: document.title }, '', initialUrl);
    })();
  } catch (e) { console.warn('page-transitions:', e.message); }


  // ── exit animation ──
  function exit(cb) {
    if (BUSY) return;
    BUSY = true;
    if (overlay) {
      overlay.style.display = '';
      overlay.style.transition = 'opacity ' + EXIT_DURATION + 'ms cubic-bezier(0.65,0,0.35,1)';
      overlay.style.opacity = '1';
    }
    document.body.classList.add('pt-exit');
    setTimeout(cb, EXIT_DURATION);
  }

  // ── enter animation ──
  function enter() {
    try {
      if (overlay) {
        overlay.style.transition = 'opacity ' + ENTER_DURATION + 'ms cubic-bezier(0.22,1,0.36,1)';
        overlay.style.opacity = '0';
      }
      if (document.body) document.body.classList.remove('pt-exit');
      setTimeout(function () {
        if (overlay) overlay.style.display = 'none';
        BUSY = false;
      }, ENTER_DURATION + 100);
    } catch (e) {
      cleanup();
    }
  }

  // ── nav active state ──
  function updateNavActive(url) {
    try {
      var path = new URL(url, window.location.origin).pathname.replace(/\/$/, '');
      var links = document.querySelectorAll('#main-nav a[href]');
      links.forEach(function (a) {
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href) return;
        var linkPath = new URL(href, window.location.origin).pathname.replace(/\/$/, '');
        var isActive = linkPath === path || (path === '' && (href === '/' || href === '/index.html'));
        if (isActive) {
          a.classList.add('text-primary', 'border-b', 'border-primary/30', 'pb-1');
          a.classList.remove('text-on-surface-variant', 'hover:text-accent-gold');
        } else {
          a.classList.remove('text-primary', 'border-b', 'border-primary/30', 'pb-1');
          a.classList.add('text-on-surface-variant', 'hover:text-accent-gold');
        }
      });
    } catch (e) { console.warn('page-transitions:', e.message); }
  }

  // ── full page navigation (replaces old SPA swapPage) ──
  function navigateTo(url) {
    if (BUSY) { window.location.href = url; return; }
    var targetUrl;
    try { targetUrl = new URL(url, window.location.href).href; } catch (e) { window.location.href = url; return; }
    if (targetUrl === CURRENT_URL) return;

    if (currentFetch) {
      currentFetch.abort();
      currentFetch = null;
    }

    var seq = ++navSequence;
    exit(function () {
      if (seq !== navSequence) return;
      // Use full page navigation to ensure all scripts and styles reload properly
      window.location.href = targetUrl;
    });
  }

  // ── popstate (back/forward) ──
  window.addEventListener('popstate', function (e) {
    if (!e.state || !e.state.url) return;
    if (e.state.url === CURRENT_URL) return;

    BUSY = false;
    ++navSequence;
    exit(function () {
      window.location.href = e.state.url;
    });
  });

  // ── link interception ──
  function isInternalLink(href) {
    if (!href || href === '#') return false;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      try { var u = new URL(href); return u.hostname === window.location.hostname; } catch (e) { return false; }
    }
    if (href.startsWith('//') || href.startsWith('tel:') || href.startsWith('mailto:')) return false;
    return true;
  }

  document.addEventListener('click', function (e) {
    try {
      var link = e.target.nodeType === 1 ? e.target.closest('a') : null;
      if (!link) return;
      var href = link.getAttribute('href');
      if (!isInternalLink(href)) return;
      if (link.getAttribute('target') === '_blank') return;
      if (href.startsWith('#')) return;
      if (link.hasAttribute('data-direct-nav')) return;
      if (/\.(pdf|zip|doc|docx|xls|xlsx)$/i.test(href)) return;

      e.preventDefault();
      e.stopPropagation();
      navigateTo(href);
    } catch (e) { console.warn('page-transitions:', e.message); }
  });

  // ── buttons with onclick location.href ──
  try {
    document.querySelectorAll('button[onclick]').forEach(function (btn) {
      if (!btn) return;
      var orig = btn.getAttribute('onclick');
      if (orig && (orig.indexOf('window.location.href') !== -1 || orig.indexOf('location.href') !== -1)) {
        btn.removeAttribute('onclick');
        btn.addEventListener('click', function (e) {
          try {
            var match = orig.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
            if (match) {
              e.preventDefault();
              if (btn.hasAttribute('data-direct-nav')) {
                window.location.href = match[1];
              } else {
                navigateTo(match[1]);
              }
            }
          } catch (e) { console.warn('page-transitions:', e.message); }
        });
      }
    });
  } catch (e) { console.warn('page-transitions:', e.message); }

  // ── prefetch on hover ──
  var prefetched = {};

  function isDownloadable(href) {
    return /\.(pdf|zip|doc|docx|xls|xlsx|exe|dmg|apk)$/i.test(href);
  }

  document.addEventListener('mouseover', function (e) {
    try {
      if (!(e.target instanceof Element)) return;
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#')) return;
      if (href.startsWith('javascript:')) return;
      if (!isInternalLink(href)) return;
      if (isDownloadable(href)) return;

      var fullUrl = new URL(href, window.location.origin).href;
      if (prefetched[fullUrl]) return;
      prefetched[fullUrl] = true;

      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = fullUrl;
      if (document.head) document.head.appendChild(l);

      fetch(fullUrl, { credentials: 'same-origin', priority: 'low' })
        .then(function () {
          if (l.parentNode) l.parentNode.removeChild(l);
        })
        .catch(function () {
          if (l.parentNode) l.parentNode.removeChild(l);
        });
    } catch (e) { console.warn('page-transitions:', e.message); }
  }, { passive: true });

  // ── handle pageshow for bfcache ──
  window.addEventListener('pageshow', function (e) {
    try {
      if (e.persisted) {
        BUSY = false;
        if (overlay) {
          overlay.style.transition = 'none';
          overlay.style.opacity = '0';
          overlay.style.display = 'none';
        }
        if (document.body) document.body.classList.remove('pt-exit');
      }
    } catch (e) { console.warn('page-transitions:', e.message); }
  });

  // ── initial enter animation ──
  if (document.readyState === 'complete') {
    setTimeout(enter, 100);
  } else {
    window.addEventListener('load', function () { setTimeout(enter, 150); });
  }

  // ── safety timeout ──
  setTimeout(function () {
    if (overlay && parseFloat(window.getComputedStyle(overlay).opacity) > 0.01) {
      overlay.style.transition = 'none';
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
      document.body.classList.remove('pt-exit');
      BUSY = false;
    }
  }, 3000);

  window.navigateTo = navigateTo;
})();