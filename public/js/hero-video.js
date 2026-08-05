(function () {
  'use strict';

  var video = null;
  var hero = null;
  var interactionRetryBound = null;
  var PLAYBACK_RATE = 0.5;

  function applyRate() {
    if (!video) return;
    try { video.playbackRate = PLAYBACK_RATE; } catch (e) {}
  }

  function playVideo() {
    if (!video) return;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function removeInteractionListeners() {
    if (!interactionRetryBound) return;
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (type) {
      window.removeEventListener(type, interactionRetryBound, { passive: true });
    });
    interactionRetryBound = null;
  }

  function onInteraction() {
    playVideo();
  }

  function initScrollBehavior() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || !hero) return;
    var SCROLL_DISTANCE = '+=300vh';
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: SCROLL_DISTANCE,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 1.5
    });
  }

  function initVisibility() {
    if (!video || !('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (video.paused && !document.hidden) playVideo();
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.01 });
    obs.observe(video);
  }

  function boot() {
    video = document.getElementById('hero-video');
    if (!video) return;
    hero = document.querySelector('.hero-root');
    if (!hero) return;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    applyRate();
    video.addEventListener('loadedmetadata', applyRate, { once: true });

    if (!reducedMotion) {
      playVideo();
      interactionRetryBound = onInteraction;
      ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (type) {
        window.addEventListener(type, interactionRetryBound, { passive: true });
      });
      if (video.readyState >= 3) {
        removeInteractionListeners();
      } else {
        video.addEventListener('playing', function onPlaying() {
          removeInteractionListeners();
          video.removeEventListener('playing', onPlaying);
        }, { once: true });
      }
    }

    setTimeout(initScrollBehavior, 300);
    initVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
