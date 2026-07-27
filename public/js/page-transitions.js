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

  // ── content swap ──
  function swapPage(html, url) {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      if (doc.querySelector('parsererror')) {
        throw new Error('invalid HTML from server');
      }

      // locate content containers before modifying anything
      var currentPageContent = document.getElementById('page-content');
      var newPageContent = doc.getElementById('page-content');
      var currentMain = null;
      var newMain = null;
      var hasContainer = false;

      if (currentPageContent && newPageContent) {
        hasContainer = true;
      } else {
        currentMain = document.querySelector('main');
        newMain = doc.querySelector('main');
        if (currentMain && newMain) {
          hasContainer = true;
        }
      }

      if (!hasContainer) {
        throw new Error('no content container found');
      }

      // title
      var newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      // OG / twitter meta
      var head = document.head;
      if (head) {
        head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(function (m) { if (m && m.remove) m.remove(); });
        doc.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(function (m) {
          if (m) head.appendChild(m.cloneNode(true));
        });

        // canonical
        var canon = head.querySelector('link[rel="canonical"]');
        var newCanon = doc.querySelector('link[rel="canonical"]');
        if (canon && newCanon) canon.setAttribute('href', newCanon.getAttribute('href'));

        // page-specific inline style blocks in head (for gallery etc.), exclude overlay style
        var oldStyles = head.querySelectorAll('style:not([id]):not([data-pt-ignore])');
        var newStyles = doc.querySelectorAll('head > style:not([id]):not([data-pt-ignore])');
        oldStyles.forEach(function (s) { if (s && !s.textContent.includes('#pt-overlay')) s.remove(); });
        newStyles.forEach(function (s) {
          if (s && !s.textContent.includes('#pt-overlay')) head.appendChild(s.cloneNode(true));
        });
      }

      // main content
      if (currentPageContent && newPageContent) {
        currentPageContent.innerHTML = newPageContent.innerHTML;
      } else if (currentMain && newMain) {
        currentMain.innerHTML = newMain.innerHTML;
        currentMain.className = newMain.className || '';
      }

      // body classes — preserve runtime state, only update page-specific
      var pageName = getPageName(url);
      if (document.body) {
        var existingClasses = document.body.className;
        if (existingClasses) {
          existingClasses.split(/\s+/).forEach(function (c) {
            if (c && c.indexOf('pt-page-') === 0) document.body.classList.remove(c);
          });
        }
        document.body.classList.add('pt-page-' + pageName);
      }

      // nav active
      updateNavActive(url);

      // clear any inline styles on nav that auth.js may have set
      var mainNav = document.getElementById('main-nav');
      if (mainNav) mainNav.style.display = '';
      var mobNavBar = document.getElementById('mobile-nav-bar');
      if (mobNavBar) {
        mobNavBar.classList.remove('hidden', 'scrolled', 'menu-open');
        mobNavBar.style.display = '';
      }
      var mobOverlay = document.getElementById('mobile-overlay');
      if (mobOverlay) mobOverlay.style.display = '';
      var mobPanel = document.getElementById('mobile-panel');
      if (mobPanel) mobPanel.style.display = '';

      // scroll to top
      window.scrollTo({ top: 0, behavior: 'auto' });

      // re-evaluate inline scripts from the fetched content
      window.__pageInit = null;
      var scripts = doc.querySelectorAll('script:not([src])');
      scripts.forEach(function (oldScript) {
        var type = (oldScript.getAttribute('type') || '').toLowerCase();
        if (type && type !== 'text/javascript' && type !== 'module' && type !== 'application/javascript') {
          return;
        }
        var newScript = document.createElement('script');
        newScript.textContent = oldScript.textContent || '';
        if (document.body) {
          document.body.appendChild(newScript);
          document.body.removeChild(newScript);
        }
      });

      // re-init shared components
      if (typeof initMobileNav === 'function') {
        try { initMobileNav(); } catch (e) { console.warn('page-transitions:', e.message); }
      }
      if (typeof FAM !== 'undefined' && FAM.Animations && typeof FAM.Animations.init === 'function') {
        try { FAM.Animations.init({ parallax: false, cardParallax: false, gsap: false, lenis: false }); } catch (e) { console.warn('page-transitions:', e.message); }
      }

      // re-apply seasonal mode state (ensures correct toggle icon after nav)
      if (typeof window.reapplySeasonal === 'function') {
        try { window.reapplySeasonal(); } catch (e) { console.warn('page-transitions:', e.message); }
      }

      // update footer year
      var footerParas = document.querySelectorAll('footer p');
      footerParas.forEach(function (p) {
        if (p) p.textContent = p.textContent.replace(/2024/g, new Date().getFullYear());
      });

      // call page-specific init
      if (typeof window.__pageInit === 'function') {
        try { window.__pageInit(); } catch (e) { console.warn('page-transitions:', e.message); }
        window.__pageInit = null;
      }

      // scroll to hash anchor if present
      var hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        var hash = url.slice(hashIndex + 1);
        if (hash) {
          var target = document.getElementById(hash);
          if (target) {
            requestAnimationFrame(function () {
              try {
                var desktopNav = document.getElementById('main-nav');
                var mobileBar = document.getElementById('mobile-nav-bar');
                var offset = 0;
                if (desktopNav && desktopNav.offsetHeight > 0) {
                  offset = desktopNav.offsetHeight;
                } else if (mobileBar && mobileBar.offsetHeight > 0) {
                  offset = mobileBar.offsetHeight + 16;
                }
                var top = target.getBoundingClientRect().top + window.scrollY - offset - 16;
                window.scrollTo({ top: top, behavior: 'smooth' });
              } catch (e) { console.warn('page-transitions:', e.message); }
            });
          }
        }
      }

      // fire event
      try { document.dispatchEvent(new CustomEvent('page:loaded', { detail: { url: url } })); } catch (e) { console.warn('page-transitions:', e.message); }
    } catch (e) {
      cleanup();
      window.location.href = url;
      throw e;
    }
  }

  function isRootUrl(url) {
    try {
      var p = new URL(url, window.location.origin).pathname;
      return p === '/' || p === '/index.html';
    } catch (e) { return false; }
  }

  // ── navigate ──
  function navigateTo(url) {
    if (BUSY) { window.location.href = url; return; }
    var targetUrl;
    try { targetUrl = new URL(url, window.location.origin).href; } catch (e) { return; }
    if (targetUrl === CURRENT_URL) return;

    if (isRootUrl(targetUrl)) {
      window.location.href = targetUrl;
      return;
    }

    if (currentFetch) {
      currentFetch.abort();
      currentFetch = null;
    }

    var controller = new AbortController();
    currentFetch = controller;

    var seq = ++navSequence;
    exit(function () {
      if (seq !== navSequence) return;
      fetch(targetUrl, { credentials: 'same-origin', signal: controller.signal })
        .then(function (r) {
          if (!r.ok) throw new Error('fetch failed');
          return r.text();
        })
        .then(function (html) {
          swapPage(html, targetUrl);
          enter();
          prefetched = {};
          history.pushState({ url: targetUrl, title: document.title }, '', targetUrl);
          CURRENT_URL = targetUrl;
        })
        .catch(function (err) {
          if (err.name === 'AbortError') return;
          BUSY = false;
          window.location.href = targetUrl;
        });
    });
  }

  // ── popstate (back/forward) ──
  window.addEventListener('popstate', function (e) {
    if (!e.state || !e.state.url) return;
    if (e.state.url === CURRENT_URL) return;

    if (isRootUrl(e.state.url)) {
      window.location.href = e.state.url;
      return;
    }

    if (currentFetch) {
      currentFetch.abort();
      currentFetch = null;
    }

    BUSY = false;
    ++navSequence;
    exit(function () {
      fetch(e.state.url, { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('fetch failed');
          return r.text();
        })
        .then(function (html) {
          swapPage(html, e.state.url);
          enter();
          CURRENT_URL = window.location.href;
          updateNavActive(window.location.href);
        })
        .catch(function () {
          window.location.href = e.state.url;
        });
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
