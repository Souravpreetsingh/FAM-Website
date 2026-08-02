(function () {
  'use strict';

  var CONFIG = {
    total: 240,
    padding: 3,
    format: 'jpg',
    prefix: 'ezgif-frame-',
    path: '/assets/frames/'
  };

  // Frames to keep decoded ahead of / behind the current scrub position.
  var LOAD_AHEAD = 24;
  var LOAD_BEHIND = 8;
  // Frames retained in memory beyond the load window before eviction.
  var KEEP_AHEAD = 48;
  var KEEP_BEHIND = 24;

  var canvas = null;
  var ctx = null;
  var frames = [];
  var pending = [];
  var totalFrames = 0;
  var currentIndex = -1;
  var desiredIndex = -1;
  var rafResize = null;
  var rafDraw = null;
  var firstFrameDrawn = false;
  var dprCached = 1;
  var lastScrollProgress = -1;
  var idlePending = false;

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  function frameSrc(idx) {
    return CONFIG.path + CONFIG.prefix + pad(idx + 1, CONFIG.padding) + '.' + CONFIG.format;
  }

  function fetchConfig() {
    return fetch('/assets/frames/frame-count.json')
      .then(function (r) { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); })
      .then(function (cfg) { CONFIG = cfg; })
      .catch(function () {});
  }

  function loadImage(idx) {
    if (frames[idx] || pending[idx]) return;
    pending[idx] = true;
    var img = new Image();
    img.decoding = 'async';
    var src = frameSrc(idx);
    img.onload = function () {
      frames[idx] = img;
      pending[idx] = false;
      if (idx === desiredIndex || (idx === 0 && !firstFrameDrawn)) scheduleDraw();
    };
    img.onerror = function () {
      pending[idx] = false;
    };
    img.src = src;
  }

  function ensureWindow(center) {
    var from = Math.max(0, center - LOAD_BEHIND);
    var to = Math.min(totalFrames - 1, center + LOAD_AHEAD);
    for (var i = from; i <= to; i++) {
      if (!frames[i] && !pending[i]) loadImage(i);
    }
  }

  function evictFrames(center) {
    var minKeep = center - KEEP_BEHIND;
    var maxKeep = center + KEEP_AHEAD;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i] && (i < minKeep || i > maxKeep)) {
        frames[i] = null;
      }
    }
  }

  function setupCanvas() {
    canvas = document.getElementById('hero-canvas');
    if (!canvas) return false;
    canvas.style.setProperty('display', 'block', 'important');
    canvas.style.setProperty('visibility', 'visible', 'important');
    canvas.style.opacity = '0';
    ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!ctx) return false;
    dprCached = Math.min(window.devicePixelRatio || 1, 2);
    resizeCanvas();
    ctx.fillStyle = '#1a3d28';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return true;
  }

  function resizeCanvas() {
    if (!canvas) return;
    var w = Math.round(window.innerWidth * dprCached);
    var h = Math.round(window.innerHeight * dprCached);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      if (currentIndex >= 0 && frames[currentIndex]) {
        var idx = currentIndex;
        currentIndex = -1;
        drawFrame(idx);
      }
    }
  }

  function drawFrame(idx) {
    if (idx === currentIndex) return;
    var img = frames[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    currentIndex = idx;
    var cw = canvas.width, ch = canvas.height;
    if (cw === 0 || ch === 0) return;
    var scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    var sx = (cw - img.naturalWidth * scale) / 2;
    var sy = (ch - img.naturalHeight * scale) / 2;
    ctx.drawImage(img, sx, sy, img.naturalWidth * scale, img.naturalHeight * scale);
    if (!firstFrameDrawn) {
      firstFrameDrawn = true;
      canvas.style.opacity = '1';
    }
  }

  function scheduleDraw() {
    if (rafDraw) return;
    rafDraw = requestAnimationFrame(function () {
      rafDraw = null;
      if (desiredIndex >= 0) drawFrame(desiredIndex);
    });
  }

  function initScrollBehavior() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    var hero = document.querySelector('.hero-root');
    if (!hero) return;
    var SCROLL_DISTANCE = '+=300vh';
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: SCROLL_DISTANCE,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 1.5,
      onUpdate: function (self) {
        var progress = self.progress;
        if (Math.abs(progress - lastScrollProgress) < 0.005) return;
        lastScrollProgress = progress;
        var idx = Math.round(progress * (totalFrames - 1));
        idx = Math.max(0, Math.min(idx, totalFrames - 1));
        desiredIndex = idx;
        ensureWindow(idx);
        evictFrames(idx);
        scheduleDraw();
      }
    });
  }

  function backgroundFill() {
    if (idlePending) return;
    idlePending = true;
    var fill = function () {
      idlePending = false;
      if (!canvas || window.scrollY > window.innerHeight * 2) return;
      var target = desiredIndex < 0 ? 0 : desiredIndex;
      var maxTarget = Math.min(totalFrames - 1, target + KEEP_AHEAD);
      var loaded = 0;
      for (var i = target; i <= maxTarget && loaded < 16; i++) {
        if (!frames[i] && !pending[i]) {
          loadImage(i);
          loaded++;
        }
      }
      if (loaded === 0) return;
      if (window.requestIdleCallback) {
        requestIdleCallback(fill, { timeout: 3000 });
      } else {
        setTimeout(fill, 400);
      }
    };
    if (window.requestIdleCallback) {
      requestIdleCallback(fill, { timeout: 2000 });
    } else {
      setTimeout(fill, 200);
    }
  }

  function boot() {
    if (!setupCanvas()) return;

    totalFrames = CONFIG.total;
    desiredIndex = 0;

    loadImage(0);
    ensureWindow(0);
    scheduleDraw();

    fetchConfig().then(function () {
      totalFrames = CONFIG.total;
    });

    setTimeout(function () {
      initScrollBehavior();
      backgroundFill();
    }, 300);
  }

  function handleResize() {
    if (rafResize) cancelAnimationFrame(rafResize);
    rafResize = requestAnimationFrame(function () {
      resizeCanvas();
      rafResize = null;
    });
  }

  window.addEventListener('resize', handleResize, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
