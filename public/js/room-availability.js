(function () {
  'use strict';
  if (!document.getElementById('fam-avail-bar')) return;
  if (document.body.dataset.famAvailReady) return;
  document.body.dataset.famAvailReady = '1';

  function apiBase() {
    if (window.FAM_API_BASE) return window.FAM_API_BASE.replace(/\/auth$/, '');
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === 'fam-website-wq2e.onrender.com') return '/api/v1';
    return 'https://fam-website-wq2e.onrender.com/api/v1';
  }

  function ymd(d) {
    if (!d) return '';
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return ymd(d);
  }

  var style = document.createElement('style');
  style.textContent =
    '#fam-avail-bar{margin:0 auto 56px;max-width:1200px;padding:0 16px}' +
    '@media(min-width:768px){#fam-avail-bar{padding:0 32px}}' +
    '.fam-avail-bar-inner{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;padding:22px 24px;background:#0b3b2c;border-radius:18px;box-shadow:0 14px 34px rgba(11,59,44,.18)}' +
    '.fam-avail-bar-inner .booking-field{flex:1 1 180px;min-width:160px}' +
    '.fam-avail-bar-inner .booking-label{color:#f5efe2}' +
    '.fam-avail-bar-inner .booking-input{border-color:#3c5f4e;background:#faf9f6;border-radius:12px}' +
    '.fam-avail-btn{flex:0 0 auto;border:none;border-radius:12px;padding:15px 26px;background:#c9a86a;color:#0b3b2c;font-weight:700;font-size:15px;letter-spacing:.02em;cursor:pointer;transition:transform .2s,box-shadow .2s;font-family:inherit}' +
    '.fam-avail-btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(0,0,0,.25)}' +
    '.fam-avail-btn:disabled{opacity:.6;cursor:wait;transform:none}' +
    '.fam-avail-note{flex-basis:100%;color:#f5efe2;font-size:13px;margin-top:2px}' +
    '.fam-avail-note.err{color:#ffd6d6}' +
    '.fam-avail-status{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:14px;width:max-content}' +
    '.fam-avail-status .fam-avail-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}' +
    '.fam-avail-ok{background:rgba(31,122,69,.12);color:#1f7a45}' +
    '.fam-avail-ok .fam-avail-dot{background:#1f7a45}' +
    '.fam-avail-no{background:rgba(186,26,26,.11);color:#b91c1c}' +
    '.fam-avail-no .fam-avail-dot{background:#b91c1c}' +
    'a.fam-avail-disabled{pointer-events:none;opacity:.5;filter:grayscale(.5)}';
  document.head.appendChild(style);

  var bar = document.getElementById('fam-avail-bar');
  bar.className = 'fam-avail-bar';

  var checkInEl = document.getElementById('fam-avail-checkin');
  var checkOutEl = document.getElementById('fam-avail-checkout');
  var btn = document.getElementById('fam-avail-check');
  var note = document.getElementById('fam-avail-note');

  function findCard(el) {
    var c = el.closest('article');
    if (c) return c;
    if (el.parentElement && el.parentElement.parentElement) return el.parentElement.parentElement;
    return null;
  }

  var cards = [];
  var seen = {};
  document.querySelectorAll('[data-fam-slideshow]').forEach(function (el) {
    var slug = el.getAttribute('data-fam-slideshow') || '';
    if (!slug || seen[slug]) return;
    var card = findCard(el);
    if (!card) return;
    var anchor = null;
    var links = card.querySelectorAll('a[href*="booking.html?room="]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('href').indexOf('room=' + slug) !== -1) { anchor = links[i]; break; }
    }
    if (!anchor) return;
    seen[slug] = true;
    cards.push({ slug: slug, card: card, anchor: anchor });
  });

  if (!cards.length) {
    bar.style.display = 'none';
    return;
  }

  checkInEl.min = ymd(new Date());
  checkOutEl.min = addDays(ymd(new Date()), 1);

  checkInEl.addEventListener('change', function () {
    if (checkInEl.value) {
      var min = addDays(checkInEl.value, 1);
      if (checkOutEl.min < min) { checkOutEl.min = min; checkOutEl.value = ''; }
    }
  });

  function setNote(msg, isErr) {
    note.textContent = msg || '';
    note.className = 'fam-avail-note' + (isErr ? ' err' : '');
  }

  function anchorFor(card) {
    var links = card.querySelectorAll('a[href*="booking.html?room="]');
    return links.length ? links[0] : null;
  }

  function setStatus(c, available, reason) {
    var anchor = anchorFor(c.card);
    var badge = c.card.querySelector('.fam-avail-status');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'fam-avail-status';
      badge.innerHTML = '<span class="fam-avail-dot"></span>';
      var actionWrap = c.anchor.parentElement;
      actionWrap.parentNode.insertBefore(badge, actionWrap);
    }
    if (available) {
      badge.className = 'fam-avail-status fam-avail-ok';
      badge.textContent = '\u2713 Available for your dates';
      if (anchor) anchor.classList.remove('fam-avail-disabled');
    } else {
      badge.className = 'fam-avail-status fam-avail-no';
      badge.textContent = reason ? '\u2715 Unavailable \u2014 ' + reason : '\u2715 Unavailable for selected dates';
      if (anchor) anchor.classList.add('fam-avail-disabled');
    }
  }

  function clearAll() {
    cards.forEach(function (c) {
      var badge = c.card.querySelector('.fam-avail-status');
      if (badge) badge.remove();
      var anchor = anchorFor(c.card);
      if (anchor) anchor.classList.remove('fam-avail-disabled');
    });
  }

  function runCheck() {
    var ci = checkInEl.value;
    var co = checkOutEl.value;
    if (!ci) { setNote('Please select your check-in date.', true); return; }
    if (!co) { setNote('Please select your check-out date.', true); return; }
    if (co <= ci) { setNote('Check-out must be after check-in.', true); return; }

    btn.disabled = true;
    btn.textContent = 'Checking\u2026';
    setNote('Checking availability\u2026');

    fetch(apiBase() + '/rooms/availability?checkIn=' + encodeURIComponent(ci) + '&checkOut=' + encodeURIComponent(co))
      .then(function (res) {
        return res.json().catch(function () { return {}; });
      })
      .then(function (json) {
        btn.disabled = false;
        btn.textContent = 'Check Availability';
        var data = json && json.data ? json.data : null;
        var list = data && data.availability ? data.availability : null;
        if (!list) {
          setNote('Backend unavailable \u2014 could not check availability.', true);
          return;
        }
        var bySlug = {};
        list.forEach(function (it) {
          if (it && it.room && it.room.slug) bySlug[it.room.slug] = it;
        });
        var matched = 0;
        var availCount = 0;
        cards.forEach(function (c) {
          var it = bySlug[c.slug];
          if (!it) return;
          matched++;
          if (it.available) availCount++;
          setStatus(c, it.available, it.reason || null);
        });
        if (matched === 0) {
          setNote('No rooms match the current listing.', true);
          return;
        }
        setNote(availCount + ' of ' + matched + ' rooms available for ' + ci + '\u00b7' + co + ' \u2014 unavailable rooms are marked below.');
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Check Availability';
        setNote('Network error \u2014 could not check availability.', true);
      });
  }

  btn.addEventListener('click', runCheck);
  checkInEl.addEventListener('input', runCheck);
  checkOutEl.addEventListener('input', runCheck);
})();