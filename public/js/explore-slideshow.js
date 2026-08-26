/**
 * FAM Explore Slideshow — Fully Automatic
 * Premium crossfade slideshow for explore destination cards.
 * No manual controls. Vanilla JS — no frameworks.
 */
var FAMExploreSlideshow = (function() {
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

  /* ---- Build slideshow HTML inside the explore card image area ---- */
  function buildSlideshow(card, destinationId) {
    var basePath = getBasePath();
    var photos = FAMGetExplorePhotos(destinationId, basePath);

    // Find or create the image container area
    var existingImg = card.querySelector('img');
    var imageContainer;

    if (existingImg) {
      // Wrap existing img in our slideshow div, replacing it
      imageContainer = document.createElement('div');
      imageContainer.className = 'fam-explore-slideshow';
      existingImg.parentNode.insertBefore(imageContainer, existingImg);
      existingImg.remove();
    } else {
      // No existing img, insert slideshow at the start of the card
      imageContainer = document.createElement('div');
      imageContainer.className = 'fam-explore-slideshow';
      card.insertBefore(imageContainer, card.firstChild);
    }

    if (!photos || photos.length === 0) {
      imageContainer.innerHTML = '<div class="fam-explore-placeholder">' +
        '<span class="material-symbols-outlined">photo_camera</span>' +
        '<span>Photos coming soon</span></div>';
      return null;
    }

    // Single photo — just show it, no slideshow
    if (photos.length === 1) {
      imageContainer.innerHTML =
        '<div class="fam-explore-slide active">' +
        '<img src="' + photos[0].src + '" alt="' + photos[0].alt + '" loading="eager" decoding="sync" />' +
        '</div>';
      return null;
    }

    var id = 'fam-ex-ss-' + destinationId + '-' + Math.random().toString(36).substring(2, 7);
    var html = '<div class="fam-explore-slideshow" id="' + id + '" data-explore="' + destinationId + '">';

    photos.forEach(function(p, i) {
      var loading = (i === 0) ? 'eager' : 'lazy';
      var decoding = (i === 0) ? 'sync' : 'async';
      var kenClass = (i % 2 === 1) ? ' ken-alt' : '';
      html += '<div class="fam-explore-slide' + (i === 0 ? ' active' : '') + kenClass + '" data-index="' + i + '">' +
        '<img src="' + p.src + '" alt="' + p.alt + '" loading="' + loading + '" decoding="' + decoding + '" /></div>';
    });

    html += '</div>';

    // Replace the container content
    imageContainer.outerHTML = html;

    var slideshow = document.getElementById(id);
    return {
      el: slideshow,
      destinationId: destinationId,
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
    var slides = inst.el.querySelectorAll('.fam-explore-slide');
    var total = slides.length;
    if (total === 0) return;

    index = ((index % total) + total) % total;
    inst.current = index;

    slides.forEach(function(s, i) {
      if (i === index) {
        // Force Ken Burns animation restart by reflowing
        s.classList.remove('active');
        s.offsetHeight; // trigger reflow
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  /* ---- Autoplay ---- */
  function startTimer(inst) {
    stopTimer(inst);
    if (!inst || inst.paused || !inst.el) return;
    var total = inst.el.querySelectorAll('.fam-explore-slide').length;
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
        var inst = null;
        for (var i = 0; i < instances.length; i++) {
          if (instances[i].el && instances[i].el.parentNode === entry.target) {
            inst = instances[i];
            break;
          }
        }
        // Also check if the entry target IS the slideshow element (direct observation)
        if (!inst) {
          for (var j = 0; j < instances.length; j++) {
            if (instances[j].el === entry.target) {
              inst = instances[j];
              break;
            }
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
  function init(card, destinationId) {
    if (!card || !destinationId) return null;
    var inst = buildSlideshow(card, destinationId);
    if (!inst) return null;
    instances.push(inst);

    // Observe for visibility optimization
    if (_observer && inst.el) {
      _observer.observe(inst.el);
    }

    // Start immediately
    startTimer(inst);
    return inst;
  }

  function initAll() {
    destroyAll();
    setupObserver();
    var cards = document.querySelectorAll('.explore-card[data-explore-destination]');
    cards.forEach(function(card) {
      var destId = card.getAttribute('data-explore-destination');
      if (destId) init(card, destId);
    });
  }

  function destroyAll() {
    instances.forEach(function(inst) {
      stopTimer(inst);
      if (_observer && inst.el) {
        _observer.unobserve(inst.el);
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
    FAMExploreSlideshow.initAll();
  });
} else {
  FAMExploreSlideshow.initAll();
}

/* Re-init on bfcache restore (back/forward) */
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    FAMExploreSlideshow.destroyAll();
    FAMExploreSlideshow.initAll();
  }
});
