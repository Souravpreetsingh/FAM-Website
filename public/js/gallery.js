/* =============================================
   GALLERY — Flamingo aur Maina
   Lightbox + scroll-reveal animations
   Vanilla JS, no frameworks
   ============================================= */

(function () {
  'use strict';

  /* -------------------------------------------
     SCROLL REVEAL (IntersectionObserver)
     ------------------------------------------- */
  function initScrollReveal() {
    var items = document.querySelectorAll('.gallery-item');
    if (!items.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      items.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      /* Fallback: reveal all immediately */
      items.forEach(function (el) {
        el.classList.add('revealed');
      });
    }
  }

  /* -------------------------------------------
     LIGHTBOX
     ------------------------------------------- */
  var lightbox = null;
  var lbImage = null;
  var lbCounter = null;
  var currentIndex = 0;
  var galleryItems = [];

  function buildLightbox() {
    /* Prevent duplicate builds */
    if (document.getElementById('galleryLightbox')) return;

    lightbox = document.createElement('div');
    lightbox.className = 'gallery-lightbox';
    lightbox.id = 'galleryLightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Image gallery');

    lightbox.innerHTML =
      '<div class="gallery-lightbox-inner">' +
        '<button class="gallery-lb-close" id="galleryLbClose" aria-label="Close gallery">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
        '<button class="gallery-lb-nav gallery-lb-prev" id="galleryLbPrev" aria-label="Previous image">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>' +
        '</button>' +
        '<button class="gallery-lb-nav gallery-lb-next" id="galleryLbNext" aria-label="Next image">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>' +
        '</button>' +
        '<div class="gallery-lightbox-img-wrap">' +
          '<img id="galleryLbImg" src="" alt="" />' +
        '</div>' +
        '<div class="gallery-lb-counter" id="galleryLbCounter"></div>' +
      '</div>';

    document.body.appendChild(lightbox);

    lbImage = document.getElementById('galleryLbImg');
    lbCounter = document.getElementById('galleryLbCounter');

    /* Event listeners */
    document.getElementById('galleryLbClose').addEventListener('click', closeLightbox);
    document.getElementById('galleryLbPrev').addEventListener('click', function () { navigateLightbox(-1); });
    document.getElementById('galleryLbNext').addEventListener('click', function () { navigateLightbox(1); });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });

    /* Keyboard */
    document.addEventListener('keydown', handleKeydown);

    /* Touch swipe on lightbox image */
    var wrap = lightbox.querySelector('.gallery-lightbox-img-wrap');
    if (wrap) {
      var touchStartX = 0;
      wrap.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      wrap.addEventListener('touchend', function (e) {
        var diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
          navigateLightbox(diff > 0 ? 1 : -1);
        }
      }, { passive: true });
    }

    /* Preload adjacent images */
    lbImage.addEventListener('load', function () {
      lbImage.classList.add('loaded');
    });

    /* Prevent body scroll when open */
    lightbox.addEventListener('transitionend', function () {
      if (lightbox.classList.contains('open')) {
        document.body.style.overflow = 'hidden';
      }
    });
  }

  function openLightbox(index) {
    if (!lightbox) buildLightbox();
    if (!galleryItems.length) return;

    currentIndex = index;
    updateLightboxImage();
    lightbox.classList.add('open');
    /* Force reflow then add loaded class */
    requestAnimationFrame(function () {
      lbImage.classList.remove('loaded');
    });
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function navigateLightbox(dir) {
    if (!galleryItems.length) return;
    currentIndex = (currentIndex + dir + galleryItems.length) % galleryItems.length;
    lbImage.classList.remove('loaded');
    updateLightboxImage();
  }

  function updateLightboxImage() {
    if (!galleryItems.length) return;
    var item = galleryItems[currentIndex];
    lbImage.src = item.src;
    lbImage.alt = item.alt || '';
    lbCounter.textContent = (currentIndex + 1) + ' / ' + galleryItems.length;
  }

  function handleKeydown(e) {
    if (!lightbox || !lightbox.classList.contains('open')) return;

    switch (e.key) {
      case 'Escape':
        closeLightbox();
        break;
      case 'ArrowLeft':
        navigateLightbox(-1);
        break;
      case 'ArrowRight':
        navigateLightbox(1);
        break;
    }
  }

  /* -------------------------------------------
     WIRE UP GALLERY ITEMS
     ------------------------------------------- */
  function initGallery() {
    var cards = document.querySelectorAll('.gallery-item');
    if (!cards.length) return;

    /* Collect data from DOM */
    galleryItems = [];
    cards.forEach(function (card, i) {
      var img = card.querySelector('img');
      if (!img) return;

      galleryItems.push({
        src: img.getAttribute('data-lb-src') || img.src,
        alt: img.alt || '',
      });

      card.addEventListener('click', function () {
        openLightbox(i);
      });
    });

    /* Wire up View Full Gallery button */
    var viewAllBtn = document.getElementById('galleryViewAll');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', function () {
        openLightbox(0);
      });
    }

    buildLightbox();
    initScrollReveal();
  }

  /* -------------------------------------------
     INIT ON DOM READY
     ------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGallery);
  } else {
    initGallery();
  }

  /* Expose for page-transitions.js or re-init */
  window.__galleryInit = initGallery;
  window.__pageInit = initGallery;

})();
