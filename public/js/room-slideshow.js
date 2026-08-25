/**
 * FAM Room Slideshow — Fully Automatic
 * Premium crossfade slideshow. No manual controls.
 * Vanilla JS — no frameworks.
 */
var FAMSlideshow = (function() {
  'use strict';

  var instances = [];
  var _initialized = false;
  var _observer = null;

  /* ---- Resolve base path ---- */
  function getBasePath() {
    var path = window.location.pathname;
    if (path.indexOf('/pages/') !== -1 || path.indexOf('/pages') === path.length - 6) {
      return '../';
    }
    return '/';
  }

  /* ---- Build slideshow HTML ---- */
  function buildSlideshow(container, roomId) {
    var basePath = getBasePath();
    var photos = FAMGetRoomPhotos(roomId, basePath);

    if (!photos || photos.length === 0) {
      container.innerHTML = '<div class="fam-slideshow-placeholder">' +
        '<span class="material-symbols-outlined">photo_camera</span>' +
        '<span>Photos coming soon</span></div>';
      return null;
    }

    // Single photo — just show it, no slideshow needed
    if (photos.length === 1) {
      container.innerHTML = '<div class="fam-slideshow">' +
        '<div class="fam-slide active">' +
        '<img src="' + photos[0].src + '" alt="' + photos[0].alt + '" loading="eager" decoding="sync" />' +
        '</div></div>';
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

    // Subtle dots indicator
    html += '<div class="fam-slideshow-dots">';
    photos.forEach(function(_, i) {
      html += '<span class="fam-slideshow-dot' + (i === 0 ? ' active' : '') + '"></span>';
    });
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    var slideshow = document.getElementById(id);
    return {
      el: slideshow,
      roomId: roomId,
      photos: photos,
      current: 0,
      timer: null,
      paused: false,
      id: id
    };
  }

  /* ---- Show a specific slide ---- */
  function showSlide(inst, index) {
    if (!inst || !inst.el) return;
    var slides = inst.el.querySelectorAll('.fam-slide');
    var dots = inst.el.querySelectorAll('.fam-slideshow-dot');
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

  /* ---- IntersectionObserver — pause when off-screen ---- */
  function setupObserver() {
    if (_observer) return;
    if (!('IntersectionObserver' in window)) return;

    _observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        // Find the instance that owns this element
        var inst = null;
        for (var i = 0; i < instances.length; i++) {
          if (instances[i].el && instances[i].el.parentNode === entry.target) {
            inst = instances[i];
            break;
          }
        }
        if (!inst) return;

        if (entry.isIntersecting) {
          inst.paused = false;
          startTimer(inst);
        } else {
          inst.paused = true;
          stopTimer(inst);
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0 });
  }

  /* ---- Public API ---- */
  function init(container, roomId) {
    if (!container || !roomId) return null;
    var inst = buildSlideshow(container, roomId);
    if (!inst) return null;
    instances.push(inst);

    // Observe for visibility optimization
    if (_observer) {
      _observer.observe(container);
    }

    // Start immediately (observer will pause/resume as needed)
    startTimer(inst);
    return inst;
  }

  function initAll() {
    destroyAll();
    setupObserver();
    var containers = document.querySelectorAll('[data-fam-slideshow]');
    containers.forEach(function(el) {
      var roomId = el.getAttribute('data-fam-slideshow');
      if (roomId) init(el, roomId);
    });
  }

  function destroyAll() {
    instances.forEach(function(inst) {
      stopTimer(inst);
      if (_observer && inst.el && inst.el.parentNode) {
        _observer.unobserve(inst.el.parentNode);
      }
    });
    instances = [];
  }

  return {
    init: init,
    initAll: initAll,
    destroyAll: destroyAll,
    getBasePath: getBasePath
  };
})();

/* Auto-init on DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    FAMSlideshow.initAll();
  });
} else {
  FAMSlideshow.initAll();
}

/* Re-init on bfcache restore (back/forward) */
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    FAMSlideshow.destroyAll();
    FAMSlideshow.initAll();
  }
});
