(function(global) {
  'use strict';

  var FAM = global.FAM || {};
  FAM.Animations = {};

  FAM.Animations.initReveal = function() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    els.forEach(function(el) { observer.observe(el); });
  };

  FAM.Animations.initRevealHidden = function() {
    var els = document.querySelectorAll('.reveal-hidden');
    if (!els.length) return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    els.forEach(function(el) { observer.observe(el); });
  };

  FAM.Animations.initParallax = function() {
    var imgs = document.querySelectorAll('.parallax-img');
    if (!imgs.length) return;
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var scrolled = window.scrollY;
          for (var i = 0; i < imgs.length; i++) {
            var speed = parseFloat(imgs[i].dataset.speed) || 0.15;
            imgs[i].style.transform = 'translate3d(0, ' + (scrolled * speed) + 'px, 0) scale(1.1)';
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  };

  FAM.Animations.initCardParallax = function() {
    var card = document.querySelector('[data-card-parallax]');
    if (!card) return;
    var ticking = false;
    document.addEventListener('mousemove', function(e) {
      if (window.innerWidth <= 1024) return;
      if (!ticking) {
        requestAnimationFrame(function() {
          var x = (e.clientX / window.innerWidth - 0.5) * 20;
          var y = (e.clientY / window.innerHeight - 0.5) * 20;
          card.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  };

  FAM.Animations.initGSAPReveal = function() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.utils.toArray('.gsap-reveal').forEach(function(el) {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
        y: 60, opacity: 0, duration: 1.2, ease: 'power3.out'
      });
    });
    gsap.utils.toArray('.gsap-mask').forEach(function(el) {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
        clipPath: 'inset(0 0 100% 0)', duration: 1.4, ease: 'power3.out'
      });
    });
    gsap.utils.toArray('[data-speed]').forEach(function(el) {
      var speed = parseFloat(el.dataset.speed) || 0.5;
      gsap.to(el, {
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        y: (el.offsetHeight * speed) / 2, ease: 'none'
      });
    });
  };

  FAM.Animations.initLenis = function() {
    if (typeof Lenis === 'undefined') return;
    if (FAM.lenis) return;
    var lenis = new Lenis({
      duration: 1.2,
      easing: function(t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5
    });
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function(time) { lenis.raf(time * 1000); });
    } else {
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }
    FAM.lenis = lenis;
  };

  FAM.Animations.init = function(opts) {
    opts = opts || {};
    var mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reducedMotion = mediaQuery.matches;
    var isMobile = window.innerWidth < 1024;

    if (reducedMotion || isMobile) {
      if (opts.reveal !== false) FAM.Animations.initReveal();
      if (opts.revealHidden !== false) FAM.Animations.initRevealHidden();
      return;
    }

    if (opts.reveal !== false) FAM.Animations.initReveal();
    if (opts.revealHidden !== false) FAM.Animations.initRevealHidden();
    if (opts.parallax !== false) FAM.Animations.initParallax();
    if (opts.cardParallax !== false) FAM.Animations.initCardParallax();
    if (opts.gsap !== false) FAM.Animations.initGSAPReveal();
    if (opts.lenis !== false) FAM.Animations.initLenis();
  };

  global.FAM = FAM;

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('img:not([loading]):not([fetchpriority="high"])').forEach(function(img) {
      img.setAttribute('loading', 'lazy');
    });
  });

})(window);
