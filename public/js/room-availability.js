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

  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function tomorrow() { var d = today(); d.setDate(d.getDate() + 1); return d; }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function fmtShort(d) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }

  var style = document.createElement('style');
  style.textContent =
    '#fam-avail-bar{margin:0 auto 56px;max-width:1200px;padding:0 16px}' +
    '@media(min-width:768px){#fam-avail-bar{padding:0 32px}}' +
    '.fam-avail-bar-inner{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:12px;padding:14px 16px;background:#0b3b2c;border-radius:14px;box-shadow:0 10px 26px rgba(11,59,44,.18)}' +
    '.fam-avail-bar-inner .booking-field{flex:0 1 232px;min-width:200px}' +
    '@media(max-width:620px){.fam-avail-bar-inner .booking-field{flex-basis:100%;min-width:0}}' +
    '.fam-avail-bar-inner .booking-label{color:#cdd6d0;display:block;margin-bottom:5px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}' +
    '.fam-avail-btn{flex:0 0 auto;align-self:center;border:none;border-radius:10px;padding:12px 22px;background:#c9a86a;color:#0b3b2c;font-weight:700;font-size:14px;letter-spacing:.02em;cursor:pointer;transition:transform .2s,box-shadow .2s;font-family:inherit}' +
    '.fam-avail-btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(0,0,0,.22)}' +
    '.fam-avail-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}' +
    '.fam-avail-note{flex-basis:100%;color:#e9efe9;font-size:12px;margin-top:2px;text-align:center}' +
    '.fam-avail-note.err{color:#ffd6d6}' +
    '.fam-avail-status{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:14px;width:max-content}' +
    '.fam-avail-status .fam-avail-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}' +
    '.fam-avail-ok{background:rgba(31,122,69,.12);color:#1f7a45}' +
    '.fam-avail-ok .fam-avail-dot{background:#1f7a45}' +
    '.fam-avail-no{background:rgba(186,26,26,.11);color:#b91c1c}' +
    '.fam-avail-no .fam-avail-dot{background:#b91c1c}' +
    'a.fam-avail-disabled{pointer-events:none;opacity:.5;filter:grayscale(.5)}' +
    // Same booking-wizard calendar used on the booking page (compact for hero)
    '.fam-cal-card{background:#fff;border-radius:10px;padding:8px 10px;box-shadow:0 2px 8px rgba(0,0,0,.10)}' +
    '.fam-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
    '.fam-cal-nav{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #e2e3df;background:transparent;cursor:pointer;color:#414942;font-size:13px;line-height:1}' +
    '.fam-cal-nav:hover{border-color:#c9a86a;color:#c9a86a}' +
    '.fam-cal-month{font-size:12px;font-weight:600;color:#1a1c1a;font-family:"Playfair Display",Georgia,serif}' +
    '.fam-cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}' +
    '.fam-cal-week span{text-align:center;font-size:9px;color:#727972;font-weight:500;padding:1px 0}' +
    '.fam-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}' +
    '.fam-cal-day{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:10px;border:none;background:transparent;color:#1a1c1a;font-weight:400;cursor:pointer;padding:0}' +
    '.fam-cal-day:hover:not(.disabled):not(.selected){background:#f2ede0}' +
    '.fam-cal-day.selected{background:#c9a86a;color:#fff;font-weight:600}' +
    '.fam-cal-day.disabled{color:#d9dad6;cursor:not-allowed}' +
    '.fam-cal-display{margin-top:6px;font-size:11px;color:#cdd6d0;text-align:center}' +
    '.fam-cal-display b{color:#fff;font-weight:600}';
  document.head.appendChild(style);

  var bar = document.getElementById('fam-avail-bar');
  bar.className = 'fam-avail-bar';

  var checkInEl = document.getElementById('fam-avail-checkin');
  var checkOutEl = document.getElementById('fam-avail-checkout');
  var btn = document.getElementById('fam-avail-check');
  var note = document.getElementById('fam-avail-note');
  if (!checkInEl || !checkOutEl) return;

  function findCard(el) {
    var c = el.closest('article');
    if (c) return c;
    if (el.parentElement && el.parentElement.parentElement) return el.parentElement.parentElement;
    return null;
  }

  var cards = [];

  function buildCards() {
    cards = [];
    var seen = {};
    document.querySelectorAll('[data-fam-slideshow]').forEach(function (el) {
      var slug = el.getAttribute('data-fam-slideshow') || '';
      if (!slug || seen[slug]) return;
      var card = findCard(el);
      if (!card) return;
      var anchor = null;
      var links = card.querySelectorAll('a[href*="booking.html?room="]');
      var any = [];
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute('href').indexOf('room=' + slug) !== -1) { anchor = links[i]; break; }
        any.push(links[i]);
      }
      if (!anchor && any.length) anchor = any[0];
      if (!anchor) return;
      seen[slug] = true;
      cards.push({ slug: slug, card: card, anchor: anchor });
    });
  }

  function showBar() {
    bar.style.display = cards.length ? '' : 'none';
  }

  buildCards();
  showBar();
  if (!cards.length) {
    window.FAMAvailBar = {
      reinit: function () {
        buildCards();
        showBar();
      },
    };
    return;
  }

  // ── Replace native date inputs with the booking-wizard style calendars ──
  var dates = { checkIn: null, checkOut: null };
  var calState = { year: today().getFullYear(), month: today().getMonth() };

  function upgradeField(prefix) {
    var input = document.getElementById('fam-avail-' + prefix);
    if (!input) return;
    var field = input.closest('.booking-field') || input.parentElement;
    var card = document.createElement('div');
    card.className = 'fam-cal-card';
    card.setAttribute('data-cal', prefix);
    var display = document.createElement('div');
    display.className = 'fam-cal-display';
    display.setAttribute('data-cal-display', prefix);
    display.textContent = 'No date selected';
    field.insertBefore(display, input);
    field.insertBefore(card, display);
    input.remove();
  }

  function minDateFor(prefix) {
    if (prefix === 'checkout' && dates.checkIn) {
      var d = new Date(dates.checkIn.getTime());
      d.setDate(d.getDate() + 1);
      return d;
    }
    return tomorrow();
  }

  function renderCal(prefix) {
    var card = document.querySelector('[data-cal="' + prefix + '"]');
    if (!card) return;
    var y = calState.year, m = calState.month;
    var days = getDaysInMonth(y, m);
    var first = getFirstDay(y, m);
    var minDate = minDateFor(prefix);
    var value = prefix === 'checkout' ? dates.checkOut : dates.checkIn;
    var monthLabel = new Date(y, m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    var html = '<div class="fam-cal-head">' +
      '<button type="button" class="fam-cal-nav" data-cal-dir="-1" data-prefix="' + prefix + '" aria-label="Previous month">‹</button>' +
      '<span class="fam-cal-month">' + monthLabel + '</span>' +
      '<button type="button" class="fam-cal-nav" data-cal-dir="1" data-prefix="' + prefix + '" aria-label="Next month">›</button>' +
      '</div>' +
      '<div class="fam-cal-week">' + ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      '<div class="fam-cal-grid">';

    for (var i = 0; i < first; i++) html += '<div></div>';

    for (var d = 1; d <= days; d++) {
      var date = new Date(y, m, d); date.setHours(0, 0, 0, 0);
      var disabled = date < minDate;
      var selected = sameDay(date, value);
      html += '<button type="button" class="fam-cal-day' + (disabled ? ' disabled' : '') + (selected ? ' selected' : '') + '" data-prefix="' + prefix + '" data-year="' + y + '" data-month="' + m + '" data-day="' + d + '"' + (disabled ? ' disabled' : '') + '>' + d + '</button>';
    }

    html += '</div>';
    card.innerHTML = html;

    card.querySelectorAll('.fam-cal-nav').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = parseInt(b.getAttribute('data-cal-dir'), 10);
        calState.month += dir;
        if (calState.month < 0) { calState.month = 11; calState.year--; }
        if (calState.month > 11) { calState.month = 0; calState.year++; }
        renderCal('checkin');
        renderCal('checkout');
      });
    });

    card.querySelectorAll('.fam-cal-day:not(.disabled)').forEach(function (b) {
      b.addEventListener('click', function () {
        var year = parseInt(b.getAttribute('data-year'), 10);
        var month = parseInt(b.getAttribute('data-month'), 10);
        var day = parseInt(b.getAttribute('data-day'), 10);
        var date = new Date(year, month, day); date.setHours(0, 0, 0, 0);
        if (b.getAttribute('data-prefix') === 'checkout') {
          dates.checkOut = date;
        } else {
          dates.checkIn = date;
          if (dates.checkOut && dates.checkOut <= date) dates.checkOut = null;
        }
        renderCal('checkin');
        renderCal('checkout');
        updateDisplays();
        if (dates.checkIn && dates.checkOut) runCheck();
      });
    });
  }

  function updateDisplays() {
    ['checkin', 'checkout'].forEach(function (prefix) {
      var el = document.querySelector('[data-cal-display="' + prefix + '"]');
      if (!el) return;
      var v = prefix === 'checkin' ? dates.checkIn : dates.checkOut;
      el.innerHTML = v ? (prefix === 'checkin' ? 'Check-in: ' : 'Check-out: ') + '<b>' + fmtShort(v) + '</b>' : 'No date selected';
    });
    if (btn) btn.disabled = !(dates.checkIn && dates.checkOut);
  }

  upgradeField('checkin');
  upgradeField('checkout');
  renderCal('checkin');
  renderCal('checkout');
  updateDisplays();

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
    var ci = ymd(dates.checkIn);
    var co = ymd(dates.checkOut);
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

  function setNote(msg, isErr) {
    note.textContent = msg || '';
    note.className = 'fam-avail-note' + (isErr ? ' err' : '');
  }

  btn.addEventListener('click', runCheck);

  window.FAMAvailBar = {
    reinit: function () {
      buildCards();
      showBar();
    },
    runCheck: runCheck,
    setDates: function (checkIn, checkOut) {
      dates.checkIn = checkIn || null;
      dates.checkOut = checkOut || null;
      if (dates.checkIn) {
        calState.year = dates.checkIn.getFullYear();
        calState.month = dates.checkIn.getMonth();
      }
      renderCal('checkin');
      renderCal('checkout');
      updateDisplays();
    },
  };
})();