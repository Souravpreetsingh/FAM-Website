(function () {
  'use strict';

  var video = null;
  var hero = null;
  var initialized = false;

  // Scroll-aware state: suppress IntersectionObserver pause during smooth scroll
  var lastScrollTime = 0;
  var SCROLL_GRACE_MS = 1200; // keep playing for 1.2s after last scroll event
  var isPlaying = false;

  // ── Single safe play wrapper ──
  function safePlay() {
    if (!video || video.ended || video.error) return;
    if (isPlaying && !video.paused) return; // already playing — skip redundant call
    var p;
    try { p = video.play(); } catch (e) { return; }
    if (p && p.catch) p.catch(function () {});
  }

  // ── Scroll tracking ──
  function onScroll() {
    lastScrollTime = Date.now();
  }

  // ── Visibility: pause when tab hidden, resume when visible ──
  function onVisibilityChange() {
    if (!video) return;
    if (document.hidden) {
      if (!video.paused) video.pause();
    } else {
      safePlay();
    }
  }

  // ── IntersectionObserver: only PAUSE when hero is fully off-screen AND not scrolling ──
  function initVisibility() {
    if (!video || !('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          // Hero in view — resume if paused and not hidden
          if (video.paused && !document.hidden) safePlay();
        } else {
          // Hero out of view — only pause if NOT mid-scroll
          // (Lenis smooth scroll fires continuous scroll events;
          //  pausing here causes the play/pause stutter loop)
          var scrolling = Date.now() - lastScrollTime < SCROLL_GRACE_MS;
          if (!scrolling && !video.paused) video.pause();
        }
      }
    }, { threshold: 0.01 });
    obs.observe(hero || video);
  }

  // ── Watchdog: resume playback if video stopped for non-scroll reasons ──
  function initWatchdog() {
    window.setInterval(function () {
      if (document.hidden || !video || video.ended || video.error) return;
      var r = video.getBoundingClientRect();
      var inView = r.bottom > 0 && r.top < window.innerHeight;
      var scrolling = Date.now() - lastScrollTime < SCROLL_GRACE_MS;
      if (inView && video.paused && !scrolling) safePlay();
    }, 8000); // relaxed interval — no tight polling
  }

  // ── Track playing state ──
  function initPlayStateTracking() {
    video.addEventListener('playing', function () { isPlaying = true; });
    video.addEventListener('pause', function () { isPlaying = false; });
    video.addEventListener('ended', function () { isPlaying = false; });
    video.addEventListener('error', function () { isPlaying = false; });
  }

  function boot() {
    video = document.getElementById('hero-video');
    if (!video || initialized) return;
    hero = document.querySelector('.hero-root');
    if (!hero) return;
    initialized = true;

    // Enforce playback attributes
    try {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.defaultMuted = true;
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
    } catch (e) {}

    initPlayStateTracking();
    safePlay();

    // Scroll listener (passive — no main-thread cost)
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });

    // Pause/resume when tab becomes hidden/visible
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Delayed visibility init (let page settle first)
    setTimeout(initVisibility, 500);
    initWatchdog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
