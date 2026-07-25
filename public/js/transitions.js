(function(){
'use strict';
var EXIT_DURATION = 600, ENTER_DELAY = 60, BUSY = false;

var page = (function(){
  var p = window.location.pathname;
  if (p === '/' || p === '/index.html') return 'home';
  var s = p.split('/').pop().replace('.html','');
  if (!s) return 'home';
  return s;
})();

document.body.classList.add('pt-page-'+page);

var overlay = document.getElementById('pt-overlay');
if (overlay) {
  overlay.style.transition = 'none';
  var cur = window.getComputedStyle(overlay).opacity;
  if (parseFloat(cur) > 0.01) { overlay.style.opacity = '1'; }
}

function exitPage(cb) {
  if (BUSY) return;
  BUSY = true;
  if (overlay) { overlay.style.transition = 'opacity 0.5s cubic-bezier(0.65,0,0.35,1)'; overlay.style.opacity = '1'; }
  document.body.classList.add('pt-exit');
  var t = document.querySelectorAll('.pt-content,main,[class*="pt-reveal"]');
  t.forEach(function(el){ el.style.transition='opacity 0.6s cubic-bezier(0.65,0,0.35,1), transform 0.6s cubic-bezier(0.65,0,0.35,1), filter 0.6s cubic-bezier(0.65,0,0.35,1)'; el.style.opacity='0'; el.style.transform='translateY(-24px)'; el.style.filter='blur(3px)'; });
  setTimeout(function(){ if (cb) cb(); }, EXIT_DURATION);
}

function enterPage() {
  if (!overlay) return;
  var ov = window.getComputedStyle(overlay).opacity;
  var visible = parseFloat(ov) > 0.01;
  
  if (visible) {
    overlay.style.transition = 'opacity 0.5s cubic-bezier(0.65,0,0.35,1)';
    overlay.style.opacity = '1';
  }
  
  var els = [];
  var mains = document.querySelectorAll('main, .pt-content');
  mains.forEach(function(m){
    var children = [];
    m.querySelectorAll('section, .hero-root, .mt-hero, .ex-hero, .planner-wrap, .cta-section, .map-section, .editorial-card, .experience-card, .explore-card, .trip-planner-wrap, .tp-card, .fam-map-wrap, .booking-bar, footer').forEach(function(s){ children.push(s); });
    if (children.length === 0) {
      for (var i=0;i<m.children.length;i++) children.push(m.children[i]);
    }
    children.forEach(function(c){ if (els.indexOf(c)===-1) els.push(c); });
  });
  if (els.length === 0) {
    document.querySelectorAll('section, .hero-root, footer').forEach(function(s){ els.push(s); });
  }
  var bodyEls = document.querySelectorAll('body > :not(#pt-overlay):not(#pt-cursor):not(.pt-loading)');
  if (els.length === 0) {
    bodyEls.forEach(function(el,i){
      if (el.id !== 'pt-overlay' && el.id !== 'pt-cursor') {
        els.push(el);
      }
    });
  }
  
  els = els.filter(function(el){ return !el.classList.contains('hero-root'); });
  els.forEach(function(el, i){
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
  });
  
  requestAnimationFrame(function(){ setTimeout(function(){
    els.forEach(function(el, i){
      setTimeout(function(){
        el.style.transition = 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 80 + i * ENTER_DELAY);
    });
    
    overlay.style.opacity = '0';
    
    setTimeout(function(){
      document.body.classList.remove('pt-enter','pt-exit');
      BUSY = false;
    }, 800 + els.length * ENTER_DELAY);
  }, visible ? 100 : 0); }); }

function isInternalLink(href) {
  if (!href || href === '#') return false;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try { var u = new URL(href); return u.hostname === window.location.hostname; } catch(e){ return false; }
  }
  if (href.startsWith('//') || href.startsWith('tel:') || href.startsWith('mailto:')) return false;
  return true;
}

function normalizeHref(href) {
  if (href.startsWith('/')) return href;
  var base = window.location.pathname.split('/').slice(0,-1).join('/');
  if (!base) return '/'+href;
  return base+'/'+href;
}

document.addEventListener('click', function(e) {
  var link = e.target.closest('a');
  if (!link) return;
  var href = link.getAttribute('href');
  if (!isInternalLink(href)) return;
  if (link.getAttribute('target') === '_blank') return;
  if (href.startsWith('#')) return;
  if (link.hasAttribute('data-direct-nav')) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  exitPage(function(){
    window.location.href = href;
  });
});

document.querySelectorAll('button[onclick]').forEach(function(btn){
  var orig = btn.getAttribute('onclick');
  if (orig && (orig.indexOf('window.location.href') !== -1 || orig.indexOf('location.href') !== -1)) {
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function(e) {
      var match = orig.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        e.preventDefault();
        if (btn.hasAttribute('data-direct-nav')) {
          window.location.href = match[1];
        } else {
          exitPage(function(){ window.location.href = match[1]; });
        }
      }
    });
  }
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    BUSY = false;
    if (overlay) {
      overlay.style.transition = 'none';
      overlay.style.opacity = '0';
    }
    document.querySelectorAll('.pt-content, main, [class*="pt-reveal"], section, .hero-root, footer').forEach(function(el) {
      el.style.transition = 'none';
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
    });
    document.body.classList.remove('pt-enter', 'pt-exit');
    return;
  }
  setTimeout(enterPage, 50);
});

if (document.readyState === 'complete') {
  setTimeout(enterPage, 100);
} else {
  window.addEventListener('load', function(){ setTimeout(enterPage, 150); });
}

setTimeout(function() {
  if (BUSY) {
    /* enterPage safety timeout */
    BUSY = false;
    if (overlay) { overlay.style.transition = 'none'; overlay.style.opacity = '0'; }
    document.querySelectorAll('section, .hero-root, footer').forEach(function(el) {
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }
}, 5000);

var cursor = document.getElementById('pt-cursor');
if (!cursor && window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
  cursor = document.createElement('div');
  cursor.id = 'pt-cursor';
  document.body.appendChild(cursor);
  var cursorTimer;
  document.addEventListener('mousemove', function(e){
    cursor.style.transform = 'translate('+(e.clientX-160)+'px,'+(e.clientY-160)+'px)';
    cursor.classList.add('visible');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function(){ cursor.classList.remove('visible'); }, 2000);
  }, { passive: true });
  document.addEventListener('mouseleave', function(){ cursor.classList.remove('visible'); }, { passive: true });
}

document.querySelectorAll('.nav-book-btn, .nav-signin-btn, .btn-primary, .btn-secondary, .hero-btn-primary, .hero-btn-secondary, .card-btn, .explore-btn, .tp-btn, .bb-cta, .nav-mobile-signin, .nav-mobile-book, [class*="btn-"], button').forEach(function(btn){
  if (btn.closest('#pt-overlay') || btn.closest('.mobile-menu-panel')) return;
  if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
    btn.classList.add('pt-btn-magnetic');
    btn.addEventListener('mousemove', function(e){
      var r = this.getBoundingClientRect();
      var dx = (e.clientX - r.left - r.width/2) * 0.15;
      var dy = (e.clientY - r.top - r.height/2) * 0.15;
      this.style.transform = 'translate('+dx+'px,'+dy+'px)';
    }, { passive: true });
    btn.addEventListener('mouseleave', function(){
      this.style.transform = '';
    }, { passive: true });
  }
});

if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
  
  gsap.utils.toArray('section:not(.hero-root), .mt-hero, .ex-hero, .editorial-card, .experience-card, .explore-card, .trip-planner-wrap, .tp-card, .fam-map-wrap, .planner-wrap, .cta-section, .map-section, .booking-bar, footer').forEach(function(el){
    var isCard = el.classList.contains('editorial-card') || el.classList.contains('experience-card') || el.classList.contains('explore-card');
    if (isCard) {
      gsap.fromTo(el, { y: 40, opacity: 0, scale: 0.97 }, {
        y: 0, opacity: 1, scale: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    } else {
      gsap.fromTo(el, { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    }
  });
  
  gsap.utils.toArray('h1, h2, h3, h4:not(nav *)').forEach(function(h){
    gsap.fromTo(h, { y: 24, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: h, start: 'top 80%', once: true }
    });
  });
  
  gsap.utils.toArray('img:not(nav img):not(footer img):not(.hero-bg-img):not(.ex-hero-bg):not([class*="marker"])').forEach(function(img){
    if (img.closest('.map-svg-wrap')) return;
    gsap.fromTo(img, { scale: 1.05, opacity: 0 }, {
      scale: 1, opacity: 1, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: img, start: 'top 85%', once: true }
    });
  });
  
  gsap.utils.toArray('.card-btn, .btn-primary, .btn-secondary, .hero-btn-primary, .hero-btn-secondary, .explore-btn, .tp-btn, .bb-cta').forEach(function(btn){
    gsap.fromTo(btn, { y: 16, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: btn, start: 'top 90%', once: true }
    });
  });
}

var loading = document.querySelector('.pt-loading');
if (!loading && document.readyState !== 'complete') {
  if (!window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
    loading = document.createElement('div');
    loading.className = 'pt-loading';
    loading.innerHTML = '<div class="pt-loading-logo">Flamingo aur Maina</div><div class="pt-loading-bar"><div class="pt-loading-bar-inner"></div></div>';
    document.body.appendChild(loading);
    window.addEventListener('load', function(){
      setTimeout(function(){ loading.classList.add('hidden'); }, 300);
      setTimeout(function(){ if (loading.parentNode) loading.parentNode.removeChild(loading); }, 1500);
    });
    setTimeout(function(){
      if (!loading.classList.contains('hidden')) {
        loading.classList.add('hidden');
        setTimeout(function(){ if (loading.parentNode) loading.parentNode.removeChild(loading); }, 1500);
      }
    }, 3000);
  }
}
})();
