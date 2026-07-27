(function () {
  'use strict';

  var lastScrollY = 0;
  var ticking = false;

  function initMobileNav() {
    var btn = document.getElementById('mobile-menu-btn');
    var panel = document.getElementById('mobile-panel');
    var overlay = document.getElementById('mobile-overlay');
    var closeBtn = document.getElementById('mobile-panel-close') || document.getElementById('mobile-close');
    var navBar = document.getElementById('mobile-nav-bar');

    if (!btn || !panel || !overlay) return;
    if (btn._navInit) return;
    btn._navInit = true;

    var focusableSel = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    function open() {
      lastFocused = document.activeElement;
      panel.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('mobile-menu-open');
      btn.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
      overlay.setAttribute('aria-hidden', 'false');
      panel.setAttribute('aria-hidden', 'false');
      if (navBar) navBar.classList.add('menu-open');
      setTimeout(function () {
        var first = panel.querySelector(focusableSel);
        if (first) first.focus();
      }, 150);
    }

    function close() {
      panel.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('mobile-menu-open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
      overlay.setAttribute('aria-hidden', 'true');
      panel.setAttribute('aria-hidden', 'true');
      if (navBar) {
        navBar.classList.remove('menu-open');
        navBar.classList.remove('hidden');
        navBar.classList.remove('scrolled');
      }
      lastScrollY = window.scrollY;
      if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
      }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) close();
      else open();
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);

    panel.querySelectorAll('.mobile-panel-link, .mobile-panel-book-btn, .mobile-panel-signin-btn, .mobile-menu-link, .nav-mobile-signin, .nav-mobile-book').forEach(function (el) {
      el.addEventListener('click', function () {
        setTimeout(close, 200);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        close();
        return;
      }
      if (e.key === 'Tab' && panel.classList.contains('open')) {
        var focusable = panel.querySelectorAll(focusableSel);
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });
  }

  function initScrollBehavior() {
    var navBar = document.getElementById('mobile-nav-bar');
    if (!navBar) return;
    if (navBar._scrollInit) return;
    navBar._scrollInit = true;

    lastScrollY = window.scrollY;

    function onScroll() {
      try {
        var currentY = window.scrollY;

        if (currentY < 50) {
          navBar.classList.remove('hidden', 'scrolled');
          lastScrollY = currentY;
          return;
        }

        if (currentY > lastScrollY && currentY > 80) {
          navBar.classList.add('hidden');
          navBar.classList.add('scrolled');
        } else {
          navBar.classList.remove('hidden');
          navBar.classList.add('scrolled');
        }

        lastScrollY = currentY;
      } finally {
        ticking = false;
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    }, { passive: true });
  }

  function initDesktopNavScroll() {
    var desktopNav = document.getElementById('main-nav');
    if (!desktopNav) return;
    if (desktopNav._dsInit) return;
    desktopNav._dsInit = true;

    var dTicking = false;

    function onScroll() {
      if (window.scrollY > 60) {
        desktopNav.classList.add('scrolled');
      } else {
        desktopNav.classList.remove('scrolled');
      }
      dTicking = false;
    }

    window.addEventListener('scroll', function () {
      if (!dTicking) {
        dTicking = true;
        requestAnimationFrame(onScroll);
      }
    }, { passive: true });
  }

  function init() {
    initMobileNav();
    initScrollBehavior();
    initDesktopNavScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initMobileNav = initMobileNav;
})();