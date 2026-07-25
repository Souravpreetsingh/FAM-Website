(function () {
  'use strict';

  var EXIT_DURATION = 350;
  var ENTER_DURATION = 450;
  var BUSY = false;
  var overlay = document.getElementById('pt-overlay');

  var CURRENT_URL = window.location.href;

  function getPageName(url) {
    var path = new URL(url, window.location.origin).pathname;
    if (path === '/' || path === '/index.html') return 'home';
    var s = path.split('/').pop().replace('.html', '');
    return s || 'home';
  }

  // ── initial page setup ──
  (function initPage() {
    var page = getPageName(window.location.href);
    document.body.classList.add('pt-page-' + page);
    if (overlay) {
      overlay.style.transition = 'none';
      if (parseFloat(window.getComputedStyle(overlay).opacity) > 0.01) {
        overlay.style.opacity = '1';
      }
    }
  })();

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
    if (overlay) {
      overlay.style.transition = 'opacity ' + ENTER_DURATION + 'ms cubic-bezier(0.22,1,0.36,1)';
      overlay.style.opacity = '0';
    }
    document.body.classList.remove('pt-exit');
    setTimeout(function () {
      if (overlay) overlay.style.display = 'none';
      BUSY = false;
    }, ENTER_DURATION + 100);
  }

  // ── nav active state ──
  function updateNavActive(url) {
    var path = new URL(url, window.location.origin).pathname.replace(/\/$/, '');
    var links = document.querySelectorAll('#main-nav a[href]');
    links.forEach(function (a) {
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
  }

  // ── content swap ──
  function swapPage(html, url) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    // title
    var newTitle = doc.querySelector('title');
    if (newTitle) document.title = newTitle.textContent;

    // OG / twitter meta
    var head = document.head;
    head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(function (m) { m.remove(); });
    doc.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(function (m) {
      head.appendChild(m.cloneNode(true));
    });

    // canonical
    var canon = head.querySelector('link[rel="canonical"]');
    var newCanon = doc.querySelector('link[rel="canonical"]');
    if (canon && newCanon) canon.setAttribute('href', newCanon.getAttribute('href'));

    // page-specific inline style blocks in head (for gallery etc.), exclude overlay style
    var oldStyles = head.querySelectorAll('style:not([id]):not([data-pt-ignore])');
    var newStyles = doc.querySelectorAll('head > style:not([id]):not([data-pt-ignore])');
    oldStyles.forEach(function (s) { if (!s.textContent.includes('#pt-overlay')) s.remove(); });
    newStyles.forEach(function (s) {
      if (!s.textContent.includes('#pt-overlay')) head.appendChild(s.cloneNode(true));
    });

    // main content
    var currentPageContent = document.getElementById('page-content');
    var newPageContent = doc.getElementById('page-content');
    if (currentPageContent && newPageContent) {
      currentPageContent.innerHTML = newPageContent.innerHTML;
    } else {
      // fallback: replace <main>
      var currentMain = document.querySelector('main');
      var newMain = doc.querySelector('main');
      if (currentMain && newMain) {
        currentMain.innerHTML = newMain.innerHTML;
        currentMain.className = newMain.className;
      }
    }

    // body classes
    var pageName = getPageName(url);
    document.body.className = doc.body.className || '';
    document.body.classList.add('pt-page-' + pageName);

    // nav active
    updateNavActive(url);

    // scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // re-evaluate inline scripts from the fetched content
    window.__pageInit = null;
    var scripts = doc.querySelectorAll('script:not([src])');
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      document.body.appendChild(newScript);
      document.body.removeChild(newScript);
    });

    // re-init shared components
    if (typeof initMobileNav === 'function') initMobileNav();

    // update footer year
    document.querySelectorAll('footer p').forEach(function (p) {
      p.innerHTML = p.innerHTML.replace(/2024/g, new Date().getFullYear());
    });

    // call page-specific init
    if (typeof window.__pageInit === 'function') {
      window.__pageInit();
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
            var desktopNav = document.getElementById('main-nav');
            var mobileBar = document.getElementById('mobile-nav-bar');
            var offset = 0;
            if (desktopNav && desktopNav.offsetHeight > 0) {
              offset = desktopNav.offsetHeight;
            } else if (mobileBar) {
              offset = mobileBar.offsetHeight + 16;
            }
            var top = target.getBoundingClientRect().top + window.scrollY - offset - 16;
            window.scrollTo({ top: top, behavior: 'smooth' });
          });
        }
      }
    }

    // fire event
    document.dispatchEvent(new CustomEvent('page:loaded', { detail: { url: url } }));

    CURRENT_URL = url;
  }

  // ── navigate ──
  function navigateTo(url) {
    if (BUSY) return;
    if (url === CURRENT_URL) return;

    exit(function () {
      fetch(url, { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('fetch failed');
          return r.text();
        })
        .then(function (html) {
          swapPage(html, url);
          enter();
          history.pushState({ url: url, title: document.title, html: html }, '', url);
        })
        .catch(function () {
          BUSY = false;
          window.location.href = url;
        });
    });
  }

  // ── popstate (back/forward) ──
  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.url) {
      BUSY = false;
      if (e.state.html) {
        exit(function () {
          swapPage(e.state.html, e.state.url);
          enter();
          CURRENT_URL = e.state.url;
        });
      } else {
        window.location.href = e.state.url;
      }
    }
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
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!isInternalLink(href)) return;
    if (link.getAttribute('target') === '_blank') return;
    if (href.startsWith('#')) return;
    if (link.hasAttribute('data-direct-nav')) return;
    // external download / file
    if (/\.(pdf|zip|doc|docx|xls|xlsx)$/i.test(href)) return;

    e.preventDefault();
    e.stopPropagation();
    navigateTo(href);
  });

  // ── buttons with onclick location.href ──
  document.querySelectorAll('button[onclick]').forEach(function (btn) {
    var orig = btn.getAttribute('onclick');
    if (orig && (orig.indexOf('window.location.href') !== -1 || orig.indexOf('location.href') !== -1)) {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function (e) {
        var match = orig.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
          e.preventDefault();
          if (btn.hasAttribute('data-direct-nav')) {
            window.location.href = match[1];
          } else {
            navigateTo(match[1]);
          }
        }
      });
    }
  });

  // ── prefetch on hover ──
  var prefetched = {};

  document.addEventListener('mouseenter', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!isInternalLink(href)) return;
    if (href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
    if (prefetched[href]) return;

    var fullUrl = new URL(href, window.location.origin).href;
    prefetched[href] = true;

    // prefetch via link element
    var l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = fullUrl;
    document.head.appendChild(l);

    // also cache html in memory for instant swap
    fetch(fullUrl, { credentials: 'same-origin', priority: 'low' })
      .then(function (r) {
        if (!r.ok) return null;
        return r.text();
      })
      .then(function (html) {
        if (html) prefetched[fullUrl] = html;
      })
      .catch(function () {});
  }, { passive: true });

  // ── handle pageshow for bfcache ──
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      BUSY = false;
      if (overlay) {
        overlay.style.transition = 'none';
        overlay.style.opacity = '0';
        overlay.style.display = 'none';
      }
      document.body.classList.remove('pt-enter', 'pt-exit');
    }
  });

  // ── initial enter animation ──
  if (document.readyState === 'complete') {
    setTimeout(enter, 100);
  } else {
    window.addEventListener('load', function () { setTimeout(enter, 150); });
  }

  // ── safety timeout ──
  setTimeout(function () {
    if (BUSY) {
      BUSY = false;
      if (overlay) { overlay.style.transition = 'none'; overlay.style.opacity = '0'; overlay.style.display = 'none'; }
      document.body.classList.remove('pt-exit');
    }
  }, 5000);
})();
