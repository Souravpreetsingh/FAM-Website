(function(global) {
  'use strict';

  var heroRoot = null;
  var bgWrap = null;
  var ambient = null;
  var particles = [];
  var mouseX = 0.5;
  var mouseY = 0.5;
  var isDesktop = window.innerWidth >= 1024;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var parallaxTicking = false;
  var magneticTicking = false;

  function createCursorGlow() {
    var el = document.createElement('div');
    el.className = 'hero-cursor-glow';
    document.body.appendChild(el);
    var cursorGlow = el;

    document.addEventListener('mousemove', function(e) {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
      el.style.transform = 'translate3d(' + e.clientX + 'px, ' + e.clientY + 'px, 0) translate(-50%, -50%)';
      if (!el.classList.contains('visible')) {
        el.classList.add('visible');
      }
    }, { passive: true });

    document.addEventListener('mouseleave', function() {
      el.classList.remove('visible');
    }, { passive: true });
  }

  function createParticles() {
    if (!ambient || reducedMotion) return;
    var count = isDesktop ? 20 : 8;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      var size = 2 + Math.random() * 3;
      var x = Math.random() * 100;
      var y = Math.random() * 100;
      var duration = 15 + Math.random() * 25;
      var delay = Math.random() * -30;
      var drift = -20 + Math.random() * 40;

      p.style.cssText =
        'position:absolute;' +
        'left:' + x + '%;' +
        'top:' + y + '%;' +
        'width:' + size + 'px;' +
        'height:' + size + 'px;' +
        'border-radius:50%;' +
        'background:rgba(255,255,255,0.15);' +
        'pointer-events:none;' +
        'animation:particleFloat ' + duration + 's ease-in-out ' + delay + 's infinite alternate;' +
        'transform:translate3d(0,0,0);' +
        'will-change:transform,opacity;';

      ambient.appendChild(p);
      particles.push(p);
    }
  }

  function initParallax() {
    if (!bgWrap || reducedMotion || !isDesktop) return;

    document.addEventListener('mousemove', function(e) {
      if (parallaxTicking) return;
      parallaxTicking = true;
      requestAnimationFrame(function() {
        var xFactor = (e.clientX / window.innerWidth - 0.5) * 6;
        var yFactor = (e.clientY / window.innerHeight - 0.5) * 4;
        bgWrap.style.transform = 'translate3d(' + xFactor + 'px, ' + yFactor + 'px, 0) scale(1.02)';
        parallaxTicking = false;
      });
    }, { passive: true });
  }

  function initMagneticButtons() {
    if (!isDesktop || reducedMotion) return;
    var btns = document.querySelectorAll('.hero-btn-primary, .hero-btn-secondary');
    btns.forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        if (magneticTicking) return;
        magneticTicking = true;
        requestAnimationFrame(function() {
          var rect = btn.getBoundingClientRect();
          var x = e.clientX - rect.left - rect.width / 2;
          var y = e.clientY - rect.top - rect.height / 2;
          var dist = Math.sqrt(x * x + y * y);
          if (dist > 100) { magneticTicking = false; return; }
          var strength = (1 - dist / 100) * 6;
          var angle = Math.atan2(y, x);
          btn.style.transform = 'translate3d(' + Math.cos(angle) * strength + 'px, ' + Math.sin(angle) * strength + 'px, 0)';
          magneticTicking = false;
        });
        magneticTicking = true;
      }, { passive: true });
      btn.addEventListener('mouseleave', function() {
        btn.style.transform = '';
      }, { passive: true });
    });
  }

  function initScrollParallax() {
    if (!heroRoot || reducedMotion) return;
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          var scrollY = window.scrollY;
          var heroHeight = heroRoot.offsetHeight;
          if (scrollY <= heroHeight) {
            var progress = scrollY / heroHeight;
            var opacity = Math.max(0, 1 - progress * 2);
            heroRoot.style.opacity = opacity;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  function addParticleKeyframes() {
    if (document.getElementById('hero-particle-style')) return;
    var style = document.createElement('style');
    style.id = 'hero-particle-style';
    style.textContent =
      '@keyframes particleFloat {' +
      '0% { transform: translate3d(0,0,0); opacity: 0; }' +
      '10% { opacity: 0.6; }' +
      '90% { opacity: 0.4; }' +
      '100% { transform: translate3d(20px,-40px,0); opacity: 0; }' +
      '}';
    document.head.appendChild(style);
  }

  function initHeroEffects() {
    var mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mediaQuery.matches;

    heroRoot = document.getElementById('hero');
    if (!heroRoot) return;

    bgWrap = heroRoot.querySelector('.hero-bg-wrap');
    ambient = document.getElementById('hero-ambient');

    if (!reducedMotion && isDesktop) {
      createCursorGlow();
      addParticleKeyframes();
      createParticles();
      initParallax();
      initMagneticButtons();
      initScrollParallax();
    }
  }

  global.initHeroEffects = initHeroEffects;

  window.addEventListener('resize', function() {
    isDesktop = window.innerWidth >= 1024;
  }, { passive: true });

})(window);
