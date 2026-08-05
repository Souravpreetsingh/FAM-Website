/* ============================================
   FAM Website — Mountain Time Experience
   ============================================ */
(function () {
  'use strict';

  var MODE_LIST = ['auto', 'morning', 'afternoon', 'sunset', 'night'];
  var MODE_DATA = {
    morning:  { icon: '\u2600\uFE0F', badge: 'Good Morning',  headline: 'Wake up with the mountains.',       sub: 'Golden sunlight, birds, and the soft hum of the valley.' },
    afternoon:{ icon: '\u2600\uFE0F', badge: 'Good Afternoon', headline: 'Nature at its brightest.',           sub: 'Blue skies, fresh air, and endless mountain views.' },
    sunset:   { icon: '\uD83C\uDF07', badge: 'Golden Hour',    headline: 'Evenings worth remembering.',        sub: 'Bonfire glow, lantern light, and the warmth of golden hour.' },
    night:    { icon: '\uD83C\uDF19', badge: 'Good Evening',   headline: 'Where the mountains come alive after dark.', sub: 'Stars, moonlight, fireflies, and the crackle of the bonfire.' }
  };

  var currentAuto = detectTime();
  var userMode = null;
  var frozen = false;

  /* --- Time detection --- */
  function detectTime() {
    var h = new Date().getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 19) return 'sunset';
    return 'night';
  }

  function getMode() { return userMode || currentAuto; }

  /* --- Apply mode --- */
  function applyMode(mode, isBoot) {
    var html = document.documentElement;
    MODE_LIST.forEach(function (m) { if (m !== 'auto') html.classList.remove('time-' + m); });
    html.classList.add('time-' + mode);

    updateContent(mode);
    updatePills(mode);
    spawnParticles(mode);
  }

  /* --- Section content --- */
  function updateContent(mode) {
    var d = MODE_DATA[mode];
    var iconEl = document.getElementById('mt-icon');
    var badgeEl = document.getElementById('mt-badge');
    var hlEl = document.getElementById('mt-headline');

    if (iconEl) iconEl.textContent = d.icon;
    if (badgeEl) badgeEl.textContent = d.badge;
    if (hlEl) {
      hlEl.style.opacity = '0';
      clearTimeout(hlEl._t);
      hlEl._t = setTimeout(function () {
        hlEl.textContent = d.headline;
        hlEl.style.opacity = '1';
      }, 400);
    }
  }

  /* --- Control panel (removed) --- */

  function updatePills(mode) {
    var btns = document.querySelectorAll('.mt-btn');
    btns.forEach(function (b) {
      b.classList.remove('mt-active');
      var m = b.getAttribute('data-mode');
      if ((!userMode && m === 'auto') || (userMode && m === userMode)) {
        b.classList.add('mt-active');
      }
    });
  }

  /* --- Particles --- */
  var particleTypes = ['mt-bird', 'mt-cloud', 'mt-star', 'mt-firefly'];
  var particleCounts = {
    'mt-bird': 2, 'mt-cloud': 2, 'mt-star': 20, 'mt-firefly': 6
  };
  var particleStyles = {
    'mt-bird': function (i, el) {
      el.style.width = '18px'; el.style.height = '10px';
      el.style.top = (12 + i * 8) + '%';
      el.style.left = '-50px';
    },
    'mt-cloud': function (i, el) {
      var w = 50 + i * 20;
      el.style.width = w + 'px'; el.style.height = (14 + i * 4) + 'px';
      el.style.top = (10 + i * 18) + '%';
    },
    'mt-star': function (i, el) {
      var s = 1 + Math.random() * 2;
      el.style.width = s + 'px'; el.style.height = s + 'px';
      el.style.top = (2 + Math.random() * 38) + '%';
      el.style.left = (Math.random() * 95) + '%';
      el.style.setProperty('--d', (2 + Math.random() * 4) + 's');
      el.style.animationDelay = (Math.random() * 3) + 's';
    },
    'mt-firefly': function (i, el) {
      el.style.bottom = (10 + Math.random() * 40) + '%';
      el.style.left = (10 + Math.random() * 80) + '%';
      el.style.setProperty('--d', (6 + Math.random() * 6) + 's');
      el.style.animationDelay = (Math.random() * 5) + 's';
    }
  };

  function spawnParticles(mode) {
    if (window.innerWidth < 1024) return;
    var existing = document.getElementById('mt-particles');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'mt-particles';

    particleTypes.forEach(function (type) {
      var show = false;
      if (type === 'mt-bird' && mode === 'morning') show = true;
      if (type === 'mt-cloud' && (mode === 'afternoon' || mode === 'sunset')) show = true;
      if (type === 'mt-star' && mode === 'night') show = true;
      if (type === 'mt-firefly' && mode === 'night') show = true;
      if (!show) return;

      var count = particleCounts[type];
      for (var i = 0; i < count; i++) {
        var el = document.createElement('div');
        el.className = type;
        if (particleStyles[type]) particleStyles[type](i, el);
        container.appendChild(el);
      }
    });

    // Bonfire glow
    var bf = document.createElement('div');
    bf.className = 'mt-bonfire';
    container.appendChild(bf);

    // Fog
    var fg = document.createElement('div');
    fg.className = 'mt-fog';
    container.appendChild(fg);

    document.body.appendChild(container);
  }

  /* --- Handle resize for mobile cleanup --- */
  function handleResize() {
    if (window.innerWidth < 1024) {
      var existing = document.getElementById('mt-particles');
      if (existing) existing.remove();
    }
  }

  var timeCheckInterval;

  /* --- Init --- */
  function init() {
    applyMode(getMode(), true);

    timeCheckInterval = setInterval(function () {
      var newAuto = detectTime();
      if (newAuto !== currentAuto) {
        currentAuto = newAuto;
        if (!frozen) applyMode(getMode());
      }
    }, 60000);

    window.addEventListener('resize', handleResize, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
