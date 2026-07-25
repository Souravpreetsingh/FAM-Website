(function () {
  'use strict';

  var isMobile = window.innerWidth <= 768;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion || isMobile) return;

  var gsap, ScrollTrigger, lenis;

  /* ============================================
     SETUP
     ============================================ */
  function initLenis() {
    if (typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      lerp: 0.07,
      wheelMultiplier: 1.0,
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.5,
    });
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function(time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }
  }

  function initScrollTrigger() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap = window.gsap;
    ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);
    initLenis();
    createChapters();
    createAtmosphere();
    createProgressBar();
    createCursorGlow();
    initParallax();
    initRevealAnimations();
  }

  /* ============================================
     SCROLL PROGRESS BAR
     ============================================ */
  function createProgressBar() {
    var bar = document.createElement('div');
    bar.className = 'ss-progress';
    bar.id = 'ss-progress';
    document.body.appendChild(bar);
    if (lenis) {
      lenis.on('scroll', function(e) {
        bar.style.transform = 'scaleX(' + e.progress + ')';
      });
    } else {
      window.addEventListener('scroll', function() {
        var h = document.documentElement;
        var p = (h.scrollTop || document.body.scrollTop) / (h.scrollHeight - h.clientHeight);
        bar.style.transform = 'scaleX(' + p + ')';
      }, { passive: true });
    }
  }

  /* ============================================
     CURSOR GLOW
     ============================================ */
  function createCursorGlow() {
    var glow = document.createElement('div');
    glow.className = 'ss-cursor-glow';
    glow.id = 'ss-cursor-glow';
    document.body.appendChild(glow);
    var isVisible = false;
    var timer;
    document.addEventListener('mousemove', function(e) {
      glow.style.transform = 'translate(' + (e.clientX - 150) + 'px, ' + (e.clientY - 150) + 'px)';
      if (!isVisible) { isVisible = true; glow.style.opacity = '1'; }
      clearTimeout(timer);
      timer = setTimeout(function() {
        glow.style.opacity = '0';
        isVisible = false;
      }, 2000);
    });
    document.addEventListener('mouseleave', function() {
      glow.style.opacity = '0';
      isVisible = false;
    });
  }

  /* ============================================
     ATMOSPHERE — Leaves, Birds, Fireflies, Stars, Moon, Mist, Light Rays
     ============================================ */
  function createAtmosphere() {
    if (window.innerWidth <= 768) return;
    var container = document.createElement('div');
    container.className = 'ss-atmosphere';
    container.id = 'ss-atmosphere';
    document.body.appendChild(container);
    createLeaves(container);
    createBirds(container);
    createFireflies(container);
    createStars(container);
    createMoon(container);
    createMist(container);
    createLightRays(container);
  }

  function createLeaves(container) {
    var leafCount = 6;
    var leafTypes = ['ss-leaf-1', 'ss-leaf-2', 'ss-leaf-3'];
    for (var i = 0; i < leafCount; i++) {
      var leaf = document.createElement('div');
      leaf.className = 'ss-leaf ' + leafTypes[i % 3];
      leaf.style.left = (5 + Math.random() * 90) + '%';
      leaf.style.top = (10 + Math.random() * 60) + '%';
      leaf.style.width = (12 + Math.random() * 12) + 'px';
      leaf.style.height = (6 + Math.random() * 8) + 'px';
      leaf.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      container.appendChild(leaf);
      animateLeaf(leaf);
    }
  }

  function animateLeaf(el) {
    var x = parseFloat(el.style.left);
    var y = parseFloat(el.style.top);
    var duration = 8 + Math.random() * 6;
    var delay = Math.random() * 4;
    var startTime = null;
    function step(t) {
      if (!startTime) startTime = t;
      var p = ((t - startTime) / 1000 + delay) % duration / duration;
      var wave = Math.sin(p * Math.PI * 4) * 20;
      var fall = p * 30;
      el.style.transform = 'translate(' + wave + 'px, ' + fall + 'px) rotate(' + (p * 720) + 'deg)';
      el.style.opacity = p > 0.85 ? (1 - (p - 0.85) / 0.15) : 0.4;
      if (p >= 1) { el.style.opacity = '0'; startTime = null; delay = Math.random() * 4; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function createBirds(container) {
    var birdCount = 3;
    for (var i = 0; i < birdCount; i++) {
      var bird = document.createElement('div');
      bird.className = 'ss-bird';
      bird.textContent = '~';
      bird.style.fontSize = (14 + Math.random() * 8) + 'px';
      bird.style.left = (10 + Math.random() * 60) + '%';
      bird.style.top = (8 + Math.random() * 20) + '%';
      bird.style.transform = 'scaleX(' + (Math.random() > 0.5 ? 1 : -1) + ')';
      container.appendChild(bird);
      animateBird(bird);
    }
  }

  function animateBird(el) {
    var startX = parseFloat(el.style.left);
    var startY = parseFloat(el.style.top);
    var duration = 12 + Math.random() * 8;
    var delay = Math.random() * 8;
    var scaleDir = el.style.transform.indexOf('-1') >= 0 ? -1 : 1;
    var startTime = null;
    function step(t) {
      if (!startTime) startTime = t;
      var p = ((t - startTime) / 1000 + delay) % duration / duration;
      var x = p * 80;
      var y = Math.sin(p * Math.PI * 3) * 15;
      var wave = Math.sin(p * Math.PI * 6) * 5;
      el.style.transform = 'translate(' + x + 'vw, ' + (y + wave) + 'px) scaleX(' + (-scaleDir) + ')';
      el.style.opacity = p > 0.85 ? (1 - (p - 0.85) / 0.15) : (p < 0.1 ? p / 0.1 : 0.3);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function createFireflies(container) {
    var count = 8;
    for (var i = 0; i < count; i++) {
      var ff = document.createElement('div');
      ff.className = 'ss-firefly';
      ff.style.left = (5 + Math.random() * 90) + '%';
      ff.style.top = (40 + Math.random() * 50) + '%';
      ff.style.width = (2 + Math.random() * 3) + 'px';
      ff.style.height = ff.style.width;
      ff.style.opacity = '0';
      container.appendChild(ff);
      animateFirefly(ff);
    }
  }

  function animateFirefly(el) {
    var sx = parseFloat(el.style.left);
    var sy = parseFloat(el.style.top);
    var dur = 3 + Math.random() * 4;
    var startTime = null;
    function step(t) {
      if (!startTime) startTime = t;
      var p = ((t - startTime) / 1000) % dur / dur;
      var x = sx + Math.sin(p * Math.PI * 2) * 8;
      var y = sy + Math.cos(p * Math.PI * 3) * 6;
      var glow = Math.sin(p * Math.PI * 6) * 0.5 + 0.5;
      el.style.transform = 'translate(' + (x - sx) + 'vw, ' + (y - sy) + 'vh)';
      el.style.opacity = glow * 0.7;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function createStars(container) {
    var count = 30;
    for (var i = 0; i < count; i++) {
      var star = document.createElement('div');
      star.className = 'ss-star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 50 + '%';
      star.style.width = (1 + Math.random() * 1.5) + 'px';
      star.style.height = star.style.width;
      star.style.opacity = (0.1 + Math.random() * 0.3).toString();
      container.appendChild(star);
    }
  }

  function createMoon(container) {
    var moon = document.createElement('div');
    moon.className = 'ss-moon';
    moon.id = 'ss-moon';
    container.appendChild(moon);
  }

  function createMist(container) {
    var mist1 = document.createElement('div');
    mist1.className = 'ss-mist-layer';
    mist1.id = 'ss-mist-layer';
    document.body.appendChild(mist1);
    var mist2 = document.createElement('div');
    mist2.className = 'ss-mist-layer-2';
    mist2.id = 'ss-mist-layer-2';
    document.body.appendChild(mist2);
  }

  function createLightRays(container) {
    for (var i = 0; i < 3; i++) {
      var ray = document.createElement('div');
      ray.className = 'ss-light-ray';
      container.appendChild(ray);
    }
  }

  /* ============================================
     AMBIENT TIME-OF-DAY SHIFT
     ============================================ */
  var ambientState = { progress: 0 };

  function updateAmbient() {
    var p = ambientState.progress;
    var atmosphere = document.getElementById('ss-atmosphere');
    if (!atmosphere) return;
    // Moon visibility
    var moon = document.getElementById('ss-moon');
    if (moon) {
      var moonOpacity = Math.max(0, Math.min(1, (p - 0.6) / 0.3));
      moon.style.opacity = moonOpacity.toString();
    }
    // Stars visibility
    var stars = atmosphere.querySelectorAll('.ss-star');
    stars.forEach(function(s) {
      var starP = Math.max(0, Math.min(1, (p - 0.5) / 0.4));
      var base = parseFloat(s.style.opacity) || 0.2;
      s.style.opacity = (base * starP).toString();
    });
    // Fireflies visibility (more active at night)
    var fireflies = atmosphere.querySelectorAll('.ss-firefly');
    fireflies.forEach(function(f) {
      var ffP = Math.max(0, Math.min(1, (p - 0.3) / 0.5));
      var current = parseFloat(f.dataset.baseOpacity) || 0.7;
      f.style.opacity = ((p > 0.6 ? ((p - 0.6) / 0.4) : 0.3) * current).toString();
    });
  }

  /* ============================================
     CHAPTERS
     ============================================ */
  function createChapters() {
    if (!gsap || !ScrollTrigger) return;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 769px)', function() {
      chapter1Arrival();
      chapter2Welcome();
      chapter3Rooms();
      chapter4Amenities();
      chapter5Experiences();
      chapter6Concierge();
      chapter7Booking();
      ambientTimeline();
    });
  }

  /* --- Chapter 1: Arrival (Hero) --- */
  function chapter1Arrival() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5,
      }
    });
    // Mist drifts away
    var mist = document.getElementById('ss-mist-layer');
    if (mist) tl.to(mist, { opacity: 0, y: -40, ease: 'power1.out' }, 0);
    var mist2 = document.getElementById('ss-mist-layer-2');
    if (mist2) tl.to(mist2, { opacity: 0, x: 60, ease: 'power1.out' }, 0);
    // Light rays intensify then fade
    var rays = document.querySelectorAll('.ss-light-ray');
    tl.to(rays, { opacity: 0.6, rotate: 5, ease: 'power1.out' }, 0.2);
    tl.to(rays, { opacity: 0, ease: 'power1.in' }, 0.6);
  }

  /* --- Chapter 2: Welcome --- */
  function chapter2Welcome() {
    var sections = [
      { id: 'welcome', trigger: '#welcome' },
      { trigger: '.max-w-max-width.mx-auto', start: 'top 85%' },
    ];
    document.querySelectorAll('.ss-fade-up, .ss-fade-in, .ss-scale-reveal, .ss-blur-reveal').forEach(function(el) {
      if (el.closest('#hero')) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        onEnter: function() { el.classList.add('ss-visible'); },
        once: true,
      });
    });
  }

  /* --- Chapter 3: Rooms --- */
  function chapter3Rooms() {
    var roomCards = document.querySelectorAll('.room-card, [class*="room"], .group');
    if (!roomCards.length) return;
    roomCards.forEach(function(card, i) {
      card.classList.add('ss-room-stagger');
      ScrollTrigger.create({
        trigger: card,
        start: 'top 88%',
        onEnter: function() {
          setTimeout(function() { card.classList.add('ss-visible'); }, i * 100);
        },
        once: true,
      });
      // Card lift
      card.classList.add('ss-card-lift');
    });
  }

  /* --- Chapter 4: Amenities --- */
  function chapter4Amenities() {
    document.querySelectorAll('.explore-card, [class*="feature"], [class*="amenity"]').forEach(function(el) {
      el.classList.add('ss-scale-reveal');
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        onEnter: function() { el.classList.add('ss-visible'); },
        once: true,
      });
      el.classList.add('ss-glass-border');
    });
  }

  /* --- Chapter 5: Experiences --- */
  function chapter5Experiences() {
    var aiSection = document.getElementById('ai-trip-planner');
    if (!aiSection) return;
    // Parallax for the SVG illustration
    var svgCol = aiSection.querySelector('.lg\\:col-span-1, [class*="col-span"]');
    if (svgCol) {
      gsap.to(svgCol, {
        y: -80,
        ease: 'none',
        scrollTrigger: {
          trigger: aiSection,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        }
      });
    }
    // Left column content reveal
    var contentCol = aiSection.querySelector('.lg\\:col-span-2, [class*="col-span"]:not([class*="col-span-1"])');
    if (contentCol) {
      ScrollTrigger.create({
        trigger: contentCol,
        start: 'top 85%',
        onEnter: function() { contentCol.classList.add('ss-visible'); },
        once: true,
      });
      contentCol.classList.add('ss-fade-up');
    }
  }

  /* --- Chapter 6: AI Concierge --- */
  function chapter6Concierge() {
    // The concierge button already exists and pulses. Enhance with glow.
    var btn = document.getElementById('concierge-btn');
    if (btn) {
      gsap.to(btn, {
        boxShadow: '0 0 30px rgba(201,168,106,0.15), 0 8px 32px rgba(10,52,29,0.15)',
        repeat: -1,
        yoyo: true,
        duration: 2,
        ease: 'sine.inOut',
      });
    }
  }

  /* --- Chapter 7: Booking --- */
  function chapter7Booking() {
    var ctaSection = document.querySelector('[class*="cta"], .max-w-max-width:last-of-type');
    if (!ctaSection) return;
    var btn = ctaSection.querySelector('button, a[class*="btn"]');
    if (btn) {
      gsap.to(btn, {
        boxShadow: '0 0 30px rgba(10,52,29,0.2), 0 8px 32px rgba(10,52,29,0.15)',
        repeat: -1,
        yoyo: true,
        duration: 2.5,
        ease: 'sine.inOut',
      });
    }
    // Warm background transition
    gsap.to(ctaSection, {
      backgroundColor: 'rgba(248,244,236,0.5)',
      scrollTrigger: {
        trigger: ctaSection,
        start: 'top 80%',
        end: 'bottom 20%',
        scrub: 1,
      }
    });
    var footer = document.querySelector('footer');
    if (footer) {
      gsap.from(footer, {
        y: 40,
        opacity: 0,
        scrollTrigger: {
          trigger: footer,
          start: 'top 90%',
          end: 'top 60%',
          scrub: 1,
        }
      });
    }
  }

  /* --- Ambient Timeline (time-of-day shift) --- */
  function ambientTimeline() {
    ScrollTrigger.create({
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: function(self) {
        ambientState.progress = self.progress;
        updateAmbient();
      }
    });
  }

  /* ============================================
     PARALLAX — Native scroll-based parallax
     ============================================ */
  function initParallax() {
    if (!gsap || !ScrollTrigger) return;
    document.querySelectorAll('[data-parallax], .ss-parallax').forEach(function(el) {
      gsap.to(el, {
        y: function() { return (el.dataset.parallaxSpeed || 30) * (window.innerHeight * 0.1) / 100; },
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      });
    });
    // Image zoom on scroll
    document.querySelectorAll('.ss-img-zoom').forEach(function(el) {
      var img = el.querySelector('img, .aspect-ratio-bg');
      if (!img) return;
      gsap.fromTo(img, { scale: 1.1 }, {
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        }
      });
    });
  }

  /* ============================================
     INTERSECTION OBSERVER REVEAL (fallback)
     ============================================ */
  function initRevealAnimations() {
    if (typeof IntersectionObserver === 'undefined') return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ss-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.ss-fade-up, .ss-fade-in, .ss-scale-reveal, .ss-blur-reveal, .ss-room-stagger, .ss-mask-reveal').forEach(function(el) {
      observer.observe(el);
    });
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (typeof gsap !== 'undefined') {
      gsap = window.gsap;
    }
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger = window.ScrollTrigger;
    }
    initScrollTrigger();
    // Fallback if GSAP didn't load
    if (!gsap || !ScrollTrigger) {
      initRevealAnimations();
      createProgressBar();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
