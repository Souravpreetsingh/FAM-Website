/**
 * FAM Room Slideshow Engine
 * Premium crossfade slideshow with autoplay, swipe, dots, counter, and lightbox.
 * Vanilla JS — no frameworks.
 *
 * Usage:
 *   FAMSlideshow.initAll()           — auto-init all [data-fam-slideshow] elements
 *   FAMSlideshow.init(el, roomId)   — init a single slideshow
 *   FAMSlideshow.destroyAll()        — teardown (for page transitions)
 */
var FAMSlideshow = (function() {
  'use strict';

  var instances = [];
  var lightboxEl = null;
  var lightboxImg = null;
  var lightboxClose = null;
  var lightboxPrev = null;
  var lightboxNext = null;
  var lightboxCounter = null;
  var lightboxThumbs = null;
  var lightboxRoomId = null;
  var lightboxPhotos = [];
  var lightboxIndex = 0;
  var lightboxKeyHandler = null;
  var _initialized = false;

  /* ---- Resolve base path ---- */
  function getBasePath() {
    var path = window.location.pathname;
    if (path.indexOf('/pages/') !== -1 || path.indexOf('/pages') === path.length - 6) {
      return '../';
    }
    return '/';
  }

  /* ---- Build slideshow HTML ---- */
  function buildSlideshow(container, roomId, mode) {
    var basePath = getBasePath();
    var photos = FAMGetRoomPhotos(roomId, basePath);

    if (!photos || photos.length === 0) {
      container.innerHTML = '<div class="fam-slideshow-placeholder">' +
        '<span class="material-symbols-outlined">photo_camera</span>' +
        '<span>Photos coming soon</span></div>';
      return null;
    }

    var id = 'fam-ss-' + roomId + '-' + Math.random().toString(36).substring(2, 7);
    var html = '<div class="fam-slideshow" id="' + id + '" data-room="' + roomId + '">';

    // Slides
    photos.forEach(function(p, i) {
      var loading = (i === 0) ? 'eager' : 'lazy';
      var decoding = (i === 0) ? 'sync' : 'async';
      html += '<div class="fam-slide' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">' +
        '<img src="' + p.src + '" alt="' + p.alt + '" loading="' + loading + '" decoding="' + decoding + '" /></div>';
    });

    // Only build controls if more than 1 photo
    if (photos.length > 1) {
      // Arrows
      html += '<button class="fam-slideshow-arrow fam-slideshow-prev" aria-label="Previous photo">&#8249;</button>';
      html += '<button class="fam-slideshow-arrow fam-slideshow-next" aria-label="Next photo">&#8250;</button>';

      // Dots
      html += '<div class="fam-slideshow-dots">';
      photos.forEach(function(_, i) {
        html += '<button class="fam-slideshow-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i + '" aria-label="Go to photo ' + (i + 1) + '"></button>';
      });
      html += '</div>';

      // Counter
      html += '<div class="fam-slideshow-counter">1 / ' + photos.length + '</div>';
    }

    // Click area for lightbox (only if more than 1 photo or even 1)
    html += '<div class="fam-slideshow-click" aria-label="View larger photo"></div>';

    html += '</div>';
    container.innerHTML = html;

    var slideshow = document.getElementById(id);
    return { el: slideshow, roomId: roomId, photos: photos, current: 0, timer: null, paused: false, id: id };
  }

  /* ---- Show a specific slide ---- */
  function showSlide(inst, index) {
    if (!inst || !inst.el) return;
    var slides = inst.el.querySelectorAll('.fam-slide');
    var dots = inst.el.querySelectorAll('.fam-slideshow-dot');
    var counter = inst.el.querySelector('.fam-slideshow-counter');
    var total = slides.length;
    if (total === 0) return;

    index = ((index % total) + total) % total;
    inst.current = index;

    slides.forEach(function(s, i) {
      s.classList.toggle('active', i === index);
    });
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === index);
    });
    if (counter) {
      counter.textContent = (index + 1) + ' / ' + total;
    }
  }

  /* ---- Autoplay ---- */
  function startTimer(inst) {
    stopTimer(inst);
    if (!inst || inst.paused || !inst.el) return;
    var total = inst.el.querySelectorAll('.fam-slide').length;
    if (total <= 1) return;
    inst.timer = setInterval(function() {
      if (!inst.paused) showSlide(inst, inst.current + 1);
    }, 4500);
  }

  function stopTimer(inst) {
    if (inst && inst.timer) {
      clearInterval(inst.timer);
      inst.timer = null;
    }
  }

  function pauseInst(inst) {
    inst.paused = true;
    stopTimer(inst);
  }

  function resumeInst(inst) {
    inst.paused = false;
    startTimer(inst);
  }

  /* ---- Lightbox ---- */
  function buildLightbox() {
    if (lightboxEl) return;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'fam-lightbox';
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-label', 'Photo viewer');
    lightboxEl.innerHTML =
      '<button class="fam-lightbox-close" aria-label="Close photo viewer">&times;</button>' +
      '<button class="fam-lightbox-arrow fam-lightbox-prev" aria-label="Previous photo">&#8249;</button>' +
      '<img class="fam-lightbox-img" src="" alt="" />' +
      '<button class="fam-lightbox-arrow fam-lightbox-next" aria-label="Next photo">&#8250;</button>' +
      '<div class="fam-lightbox-thumbs"></div>' +
      '<div class="fam-lightbox-counter"></div>';
    document.body.appendChild(lightboxEl);

    lightboxImg = lightboxEl.querySelector('.fam-lightbox-img');
    lightboxClose = lightboxEl.querySelector('.fam-lightbox-close');
    lightboxPrev = lightboxEl.querySelector('.fam-lightbox-prev');
    lightboxNext = lightboxEl.querySelector('.fam-lightbox-next');
    lightboxCounter = lightboxEl.querySelector('.fam-lightbox-counter');
    lightboxThumbs = lightboxEl.querySelector('.fam-lightbox-thumbs');

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', function() { navigateLightbox(-1); });
    lightboxNext.addEventListener('click', function() { navigateLightbox(1); });
    lightboxEl.addEventListener('click', function(e) {
      if (e.target === lightboxEl) closeLightbox();
    });

    // Touch swipe in lightbox
    var lbTouchStartX = 0;
    var lbTouchStartY = 0;
    lightboxEl.addEventListener('touchstart', function(e) {
      lbTouchStartX = e.touches[0].clientX;
      lbTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    lightboxEl.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - lbTouchStartX;
      var dy = e.changedTouches[0].clientY - lbTouchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        navigateLightbox(dx > 0 ? -1 : 1);
      }
    }, { passive: true });
  }

  function openLightbox(roomId, photos, startIndex) {
    buildLightbox();
    lightboxRoomId = roomId;
    lightboxPhotos = photos;
    lightboxIndex = startIndex || 0;

    // Build thumbs
    var thumbsHtml = '';
    photos.forEach(function(p, i) {
      thumbsHtml += '<div class="fam-lightbox-thumb' + (i === lightboxIndex ? ' active' : '') + '" data-index="' + i + '">' +
        '<img src="' + p.src + '" alt="" loading="lazy" /></div>';
    });
    lightboxThumbs.innerHTML = thumbsHtml;
    lightboxThumbs.querySelectorAll('.fam-lightbox-thumb').forEach(function(t) {
      t.addEventListener('click', function() {
        lightboxIndex = parseInt(t.getAttribute('data-index'));
        updateLightbox();
      });
    });

    updateLightbox();
    lightboxEl.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Keyboard
    lightboxKeyHandler = function(e) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') navigateLightbox(-1);
      else if (e.key === 'ArrowRight') navigateLightbox(1);
    };
    document.addEventListener('keydown', lightboxKeyHandler);
  }

  function updateLightbox() {
    if (!lightboxEl || !lightboxPhotos.length) return;
    var p = lightboxPhotos[lightboxIndex];
    lightboxImg.style.opacity = '0';
    setTimeout(function() {
      lightboxImg.src = p.src;
      lightboxImg.alt = p.alt;
      lightboxImg.onload = function() { lightboxImg.style.opacity = '1'; };
      if (lightboxImg.complete) lightboxImg.style.opacity = '1';
    }, 150);
    lightboxCounter.textContent = (lightboxIndex + 1) + ' / ' + lightboxPhotos.length;
    // Update thumbs
    lightboxThumbs.querySelectorAll('.fam-lightbox-thumb').forEach(function(t, i) {
      t.classList.toggle('active', i === lightboxIndex);
    });
    // Scroll thumb into view
    var activeThumb = lightboxThumbs.querySelector('.fam-lightbox-thumb.active');
    if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function navigateLightbox(dir) {
    lightboxIndex = ((lightboxIndex + dir) + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightbox();
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('open');
    document.body.style.overflow = '';
    if (lightboxKeyHandler) {
      document.removeEventListener('keydown', lightboxKeyHandler);
      lightboxKeyHandler = null;
    }
  }

  /* ---- Bind events to a slideshow instance ---- */
  function bindEvents(inst) {
    if (!inst || !inst.el) return;
    var el = inst.el;

    // Pause on hover
    el.addEventListener('mouseenter', function() { pauseInst(inst); });
    el.addEventListener('mouseleave', function() { resumeInst(inst); });

    // Arrow clicks
    var prevBtn = el.querySelector('.fam-slideshow-prev');
    var nextBtn = el.querySelector('.fam-slideshow-next');
    if (prevBtn) prevBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      showSlide(inst, inst.current - 1);
      pauseInst(inst);
      setTimeout(function() { resumeInst(inst); }, 8000);
    });
    if (nextBtn) nextBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      showSlide(inst, inst.current + 1);
      pauseInst(inst);
      setTimeout(function() { resumeInst(inst); }, 8000);
    });

    // Dot clicks
    el.querySelectorAll('.fam-slideshow-dot').forEach(function(dot) {
      dot.addEventListener('click', function() {
        showSlide(inst, parseInt(dot.getAttribute('data-index')));
        pauseInst(inst);
        setTimeout(function() { resumeInst(inst); }, 8000);
      });
    });

    // Click to open lightbox
    var clickArea = el.querySelector('.fam-slideshow-click');
    if (clickArea) {
      clickArea.addEventListener('click', function() {
        openLightbox(inst.roomId, inst.photos, inst.current);
      });
    }

    // Touch swipe
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    el.addEventListener('touchstart', function(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      pauseInst(inst);
    }, { passive: true });
    el.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      var dt = Date.now() - touchStartTime;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && dt < 500) {
        showSlide(inst, dx > 0 ? inst.current - 1 : inst.current + 1);
      }
      setTimeout(function() { resumeInst(inst); }, 6000);
    }, { passive: true });
  }

  /* ---- Public API ---- */
  function init(container, roomId, mode) {
    if (!container || !roomId) return null;
    var inst = buildSlideshow(container, roomId, mode);
    if (!inst) return null;
    instances.push(inst);
    bindEvents(inst);
    startTimer(inst);
    return inst;
  }

  function initAll() {
    destroyAll();
    var containers = document.querySelectorAll('[data-fam-slideshow]');
    containers.forEach(function(el) {
      var roomId = el.getAttribute('data-fam-slideshow');
      if (roomId) init(el, roomId);
    });
  }

  function destroyAll() {
    instances.forEach(function(inst) {
      stopTimer(inst);
    });
    instances = [];
  }

  function refresh(container, roomId) {
    // Destroy existing instance for this container
    instances = instances.filter(function(inst) {
      if (inst.el && inst.el.parentNode === container) {
        stopTimer(inst);
        return false;
      }
      return true;
    });
    return init(container, roomId);
  }

  // Initialize lightbox DOM once
  function initLightbox() {
    buildLightbox();
  }

  return {
    init: init,
    initAll: initAll,
    destroyAll: destroyAll,
    refresh: refresh,
    initLightbox: initLightbox,
    getBasePath: getBasePath
  };
})();

/* Auto-init on DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    FAMSlideshow.initLightbox();
    FAMSlideshow.initAll();
  });
} else {
  FAMSlideshow.initLightbox();
  FAMSlideshow.initAll();
}

/* Re-init on bfcache restore (back/forward) */
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    FAMSlideshow.destroyAll();
    FAMSlideshow.initAll();
  }
});
