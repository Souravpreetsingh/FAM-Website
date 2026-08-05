(function () {
  'use strict';

  var video = null;
  var hero = null;
  var playAttempted = false;
  var interactionRetryBound = null;

  function tryPlay() {
    if (!video || playAttempted) return;
    playAttempted = true;
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        playAttempted = false;
      });
    }
  }

  function retryOnInteraction() {
    tryPlay();
    if (playAttempted && interactionRetryBound) {
      removeInteractionListeners();
    }
  }

  function removeInteractionListeners() {
    if (!interactionRetryBound) return;
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (type) {
      window.removeEventListener(type, interactionRetryBound, { passive: true });
    });
    interactionRetryBound = null;
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

  function initVisibilityPause() {
    if (!video || !('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (playAttempted && video.paused && !document.hidden) tryPlay();
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
    if (!reducedMotion) {
      tryPlay();
    }

    if (playAttempted) {
      interactionRetryBound = retryOnInteraction;
      ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (type) {
        window.addEventListener(type, interactionRetryBound, { passive: true });
      });
    }

    setTimeout(initScrollBehavior, 300);
    initVisibilityPause();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
