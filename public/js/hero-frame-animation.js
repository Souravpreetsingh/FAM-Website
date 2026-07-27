(function () {
  'use strict';

  var CONFIG = {
    total: 240,
    padding: 3,
    format: 'jpg',
    prefix: 'ezgif-frame-',
    path: '/assets/frames/'
  };
  var canvas = null;
  var ctx = null;
  var frames = [];
  var totalFrames = 0;
  var currentIndex = -1;
  var rafResize = null;
  var isLoading = false;
  var firstFrameDrawn = false;
  var dprCached = 1;
  var lastScrollProgress = -1;

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
    return new Promise(function (resolve) {
      var img = new Image();
      var src = frameSrc(idx);
      img.onload = function () {
        frames[idx] = img;
        resolve(true);
      };
      img.onerror = function () {
        resolve(false);
      };
      img.src = src;
      if (img.complete && img.naturalWidth > 0) {
        frames[idx] = img;
        resolve(true);
      } else if (img.complete) {
        resolve(false);
      }
    });
  }

  function setupCanvas() {
    canvas = document.getElementById('hero-canvas');
    if (!canvas) return false;
    canvas.style.setProperty('display', 'block', 'important');
    canvas.style.setProperty('visibility', 'visible', 'important');
    canvas.style.opacity = '0';
    canvas.style.willChange = 'transform';
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
    ctx.clearRect(0, 0, cw, ch);
    var scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    var sx = (cw - img.naturalWidth * scale) / 2;
    var sy = (ch - img.naturalHeight * scale) / 2;
    ctx.drawImage(img, sx, sy, img.naturalWidth * scale, img.naturalHeight * scale);
    if (!firstFrameDrawn) {
      firstFrameDrawn = true;
      canvas.style.opacity = '1';
    }
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
        drawFrame(idx);
      }
    });
  }

  function loadBatch(start) {
    if (start >= totalFrames || isLoading) return;
    isLoading = true;
    var end = Math.min(start + 8, totalFrames);
    var promises = [];
    for (var i = start; i < end; i++) {
      if (frames[i]) continue;
      promises.push(loadImage(i));
    }
    Promise.all(promises).then(function () {
      isLoading = false;
      loadBatch(end);
    });
  }

  function boot() {
    if (!setupCanvas()) return;

    totalFrames = CONFIG.total;

    loadImage(0).then(function (ok) {
      if (ok) drawFrame(0);
    });

    fetchConfig().then(function () {
      totalFrames = CONFIG.total;
    });

    if (window.requestIdleCallback) {
      requestIdleCallback(function () { loadBatch(1); }, { timeout: 3000 });
    } else {
      setTimeout(function () { loadBatch(1); }, 200);
    }

    setTimeout(initScrollBehavior, 300);
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
