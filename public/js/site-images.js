/*
 * Public image overrides.
 *
 * The site is static HTML, so the image currently wired into each slot stays in
 * the markup and renders exactly as before. When the owner replaces a slot from
 * the admin Images view, the new URL is stored in MongoDB and fetched here, then
 * swapped in at runtime. No rebuild, no deploy.
 *
 * Two ways to hook a slot up:
 *   <img data-fam-img="home.story" src="images/fam-big-pic.jpg">
 *   <div data-fam-bg="home.cta" style="background-image: url('...')">
 *   <meta data-fam-meta="home.og" content="https://...">
 * Attribute-name variants (poster, href) use data-fam-attr="poster|href".
 *
 * For images built in JavaScript, pass the key through the resolver and tag the
 * element so a late-arriving map can still correct it:
 *   src = FamImages.url('rooms.flamingo-1.1', defaultSrc)
 */
(function () {
  var ENDPOINT = '/api/v1/site-images';
  var CACHE_KEY = 'fam_image_overrides';
  var CACHE_TTL_MS = 60 * 1000;

  var urls = {};
  var alts = {};
  var loaded = false;
  var pending = null;

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.at) return null;
      if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
      return parsed.data || null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) {
      /* private mode / quota — the network result still applies */
    }
  }

  function load() {
    if (pending) return pending;

    var cached = readCache();
    if (cached) {
      urls = cached.urls || {};
      alts = cached.alts || {};
      loaded = true;
      pending = Promise.resolve(urls);
      apply();
      return pending;
    }

    pending = fetch(ENDPOINT, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (body) {
        if (body && body.success && body.data) {
          urls = body.data.urls || {};
          alts = body.data.alts || {};
          writeCache(body.data);
        }
        loaded = true;
        return urls;
      })
      .catch(function () {
        // Offline, blocked, or endpoint not deployed yet: keep the markup as-is.
        loaded = true;
        return urls;
      });

    return pending;
  }

  function isOverridden(key) {
    return !!urls[key];
  }

  function apply() {
    if (!loaded) return;

    // <img src> and any other attribute variant.
    var imgNodes = document.querySelectorAll('[data-fam-img]');
    Array.prototype.forEach.call(imgNodes, function (el) {
      var key = el.getAttribute('data-fam-img');
      var next = urls[key];
      if (!next) return;
      var attr = el.getAttribute('data-fam-attr') || 'src';
      if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
      if (alts[key] && el.tagName === 'IMG' && !el.getAttribute('data-fam-alt-locked')) {
        el.setAttribute('alt', alts[key]);
      }
    });

    // CSS background-image.
    var bgNodes = document.querySelectorAll('[data-fam-bg]');
    Array.prototype.forEach.call(bgNodes, function (el) {
      var next = urls[el.getAttribute('data-fam-bg')];
      if (!next) return;
      el.style.backgroundImage = 'url("' + next + '")';
    });

    // <meta content>.
    var metaNodes = document.querySelectorAll('[data-fam-meta]');
    Array.prototype.forEach.call(metaNodes, function (el) {
      var next = urls[el.getAttribute('data-fam-meta')];
      if (next) el.setAttribute('content', next);
    });
  }

  var FamImages = {
    ready: null,

    // Resolve a URL for a slot. Safe to call synchronously: before the map has
    // loaded it returns the fallback, and the DOM pass corrects it afterwards.
    url: function (key, fallback) {
      if (!key) return fallback;
      return urls[key] || fallback;
    },

    alt: function (key, fallback) {
      if (!key) return fallback;
      return alts[key] || fallback;
    },

    isOverridden: isOverridden,

    // Re-scan after injecting markup that carries data-fam-* attributes.
    reapply: apply,

    // Drop the short-lived cache and refetch, e.g. right after an admin change.
    refresh: function () {
      try {
        sessionStorage.removeItem(CACHE_KEY);
      } catch (e) {
        /* ignore */
      }
      urls = {};
      alts = {};
      loaded = false;
      pending = null;
      // Start a real fetch and hand back a promise for it. Returning the old
      // FamImages.ready here would resolve instantly and never refetch.
      FamImages.ready = load().then(function () {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', apply);
        } else {
          apply();
        }
        return urls;
      });
      return FamImages.ready;
    },
  };

  window.FamImages = FamImages;

  // Kick off immediately so the map is usually in hand by first paint.
  FamImages.ready = load().then(function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
    return urls;
  });
})();
