(function () {
  'use strict';

  var state = {
    step: 1,
    checkIn: null,
    checkOut: null,
    adults: 2,
    children: 0,
    rooms: 1,
    pets: 0,
    tripType: null,
    addons: {},
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calYearOut: new Date().getFullYear(),
    calMonthOut: (new Date().getMonth() + 1) % 12,
    calYearOutAdj: new Date().getFullYear() + (new Date().getMonth() + 1 > 11 ? 1 : 0)
  };

  var ROOM_DATA = {
    'Romantic Getaway': { room: 'Maina 1', price: 2500, image: '💑', scores: { mountain: 85, privacy: 92, sunrise: 88, work: 40, luxury: 75 }, nights: 2 },
    'Family Vacation': { room: 'Flamingo 3', price: 6000, image: '👨‍👩‍👧‍👦', scores: { mountain: 78, privacy: 65, sunrise: 60, work: 55, luxury: 70 }, nights: 3 },
    'Work From Mountains': { room: 'Maina 2', price: 2000, image: '💻', scores: { mountain: 70, privacy: 80, sunrise: 50, work: 95, luxury: 60 }, nights: 5 },
    'Adventure Trek': { room: 'Flamingo 1', price: 3000, image: '🥾', scores: { mountain: 95, privacy: 60, sunrise: 90, work: 30, luxury: 55 }, nights: 3 },
    'Solo Retreat': { room: 'Maina 2', price: 2000, image: '🧘', scores: { mountain: 82, privacy: 95, sunrise: 85, work: 60, luxury: 65 }, nights: 3 },
    'Friends Trip': { room: 'Flamingo 1', price: 3000, image: '🎉', scores: { mountain: 80, privacy: 50, sunrise: 70, work: 35, luxury: 60 }, nights: 2 },
    'Wellness Escape': { room: 'Flamingo 3', price: 4500, image: '🌿', scores: { mountain: 88, privacy: 85, sunrise: 92, work: 45, luxury: 80 }, nights: 4 }
  };

  var ADDON_DATA = [
    { id: 'bonfire', icon: '🔥', name: 'Bonfire Night', price: 500 },
    { id: 'trek', icon: '🥾', name: 'Guided Trek', price: 1500 },
    { id: 'breakfast', icon: '☕', name: 'Cafe Breakfast', price: 350 },
    { id: 'pickup', icon: '🚗', name: 'Airport Pickup', price: 2500 },
    { id: 'photo', icon: '📸', name: 'Photography Tour', price: 2000 },
    { id: 'laundry', icon: '🧺', name: 'Laundry Service', price: 300 },
    { id: 'cab', icon: '🚙', name: 'Cab Booking', price: 800 }
  ];

  var TRIP_TYPES = [
    { id: 'Romantic Getaway', icon: '💑', label: 'Romantic', desc: 'For couples escaping to the hills' },
    { id: 'Family Vacation', icon: '👨‍👩‍👧‍👦', label: 'Family', desc: 'Fun for the whole family' },
    { id: 'Work From Mountains', icon: '💻', label: 'Workcation', desc: 'Work with mountain views' },
    { id: 'Adventure Trek', icon: '🥾', label: 'Adventure', desc: 'Trek through Jibhi trails' },
    { id: 'Solo Retreat', icon: '🧘', label: 'Solo', desc: 'Time for yourself' },
    { id: 'Friends Trip', icon: '🎉', label: 'Friends', desc: 'Group mountain getaway' },
    { id: 'Wellness Escape', icon: '🌿', label: 'Wellness', desc: 'Rejuvenate body & mind' }
  ];

  var ITINERARY = {
    'Romantic Getaway': [
      { title: 'Arrival & Sunset', items: ['Arrive at FAM', 'Welcome tea', 'Sunset at Jibhi Waterfall', 'Candlelight dinner'] },
      { title: 'Trek & Picnic', items: ['Breakfast in cafe', 'Guided forest trek', 'Picnic by the stream', 'Bonfire night'] },
      { title: 'Departure', items: ['Slow morning', 'Breakfast', 'Checkout', 'Visit Mini Thailand en route'] }
    ],
    'Family Vacation': [
      { title: 'Settle In', items: ['Arrival', 'Room allocation', 'Kids play area', 'Family dinner'] },
      { title: 'Explore', items: ['Breakfast', 'Jibhi Waterfall visit', 'Village walk', 'Board games night'] },
      { title: 'Adventure Day', items: ['Breakfast', 'Mini Thailand picnic', 'Packing', 'Departure'] }
    ],
    'Adventure Trek': [
      { title: 'Arrive & Prep', items: ['Check in', 'Gear check', 'Trail briefing', 'Rest'] },
      { title: 'Jalori Pass', items: ['Early breakfast', 'Drive to Jalori Pass', 'Serolsar Lake trek', 'Return'] },
      { title: 'Waterfall & Go', items: ['Morning waterfall trek', 'Brunch', 'Checkout'] }
    ],
    'Solo Retreat': [
      { title: 'Arrive & Unwind', items: ['Quiet check-in', 'Tea on the balcony', 'Nature walk', 'Journal by fire'] },
      { title: 'Recharge', items: ['Sunrise yoga', 'Cafe reading', 'Afternoon nap', 'Star gazing'] },
      { title: 'Return', items: ['Meditation', 'Breakfast', 'Checkout'] }
    ],
    'Wellness Escape': [
      { title: 'Arrive & Detox', items: ['Herbal welcome', 'Breathwork session', 'Forest bath walk', 'Light dinner'] },
      { title: 'Deep Wellness', items: ['Sunrise yoga', 'Trek to waterfall', 'Healthy lunch', 'Evening meditation'] },
      { title: 'Integrate', items: ['Morning stretch', 'Wellness breakfast', 'Journaling', 'Depart renewed'] }
    ]
  };

  function getDefaultItinerary(type) {
    return ITINERARY[type] || [
      { title: 'Arrival & Explore', items: ['Check in', 'Evening walk', 'Cafe visit', 'Bonfire'] },
      { title: 'Full Day Experience', items: ['Breakfast', 'Forest trek', 'Waterfall visit', 'Dinner'] },
      { title: 'Departure', items: ['Breakfast', 'Last walk', 'Checkout', 'Travel home'] }
    ];
  }

  /* === Utilities === */
  function getTimestamp() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function formatDate(d) {
    if (!d) return '';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateShort(d) {
    if (!d) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function today() { var d = new Date(); d.setHours(0,0,0,0); return d; }

  function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  function isBeforeDay(a, b) { return a && b && a.getTime() < b.getTime(); }

  function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }

  function getNights() {
    if (!state.checkIn || !state.checkOut) return 0;
    return Math.max(0, Math.round((state.checkOut.getTime() - state.checkIn.getTime()) / 86400000));
  }

  function calcPrice() {
    var nights = getNights();
    var trip = ROOM_DATA[state.tripType];
    var baseRate = trip ? trip.price : 3000;
    var roomTotal = nights * state.rooms * baseRate;
    var addonTotal = 0;
    for (var id in state.addons) {
      if (state.addons[id]) {
        var found = ADDON_DATA.filter(function(a) { return a.id === id; });
        if (found.length) addonTotal += found[0].price;
      }
    }
    var tax = Math.round(roomTotal * 0.12);
    var discount = nights >= 3 ? Math.round(roomTotal * 0.08) : 0;
    var weekendSurcharge = 0;
    if (state.checkIn) {
      var d = state.checkIn.getDay();
      if (d === 5 || d === 6) weekendSurcharge = Math.round(roomTotal * 0.1);
    }
    var total = roomTotal + tax + addonTotal + weekendSurcharge - discount;
    return { roomTotal: roomTotal, tax: tax, addonTotal: addonTotal, discount: discount, weekendSurcharge: weekendSurcharge, total: Math.max(0, total), nights: nights, baseRate: baseRate };
  }

  function smoothScroll(el) {
    if (!el) return;
    var target = el.scrollTopMax !== undefined ? el.scrollTopMax : el.scrollHeight - el.clientHeight;
    var start = el.scrollTop, diff = target - start, duration = 300, startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var p = Math.min((ts - startTime) / duration, 1);
      el.scrollTop = start + diff * (1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* === Magnetic Trigger === */
  function initMagnetic(el) {
    if (!el) return;
    var move = function(e) {
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      if (Math.sqrt(dx*dx + dy*dy) > 150) { el.style.transform = ''; return; }
      el.style.transform = 'translate(' + (dx * 0.2) + 'px, ' + (dy * 0.2) + 'px)';
    };
    var reset = function() { el.style.transform = ''; };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', reset);
  }

  /* === Build UI === */
  var panelBuilt = false;

  function buildTrigger() {
    if (document.getElementById('bk-trigger')) return;
    var t = document.createElement('button');
    t.className = 'bk-trigger';
    t.id = 'bk-trigger';
    t.setAttribute('aria-label', 'Book your stay');
    t.innerHTML = '<span class="bk-trigger-glow"></span><span class="bk-trigger-icon">✦</span><span>Book Now</span>';
    document.body.appendChild(t);
    initMagnetic(t);
    t.addEventListener('click', open);
  }

  function buildPanel() {
    if (panelBuilt) return;
    panelBuilt = true;

    var overlay = document.createElement('div');
    overlay.className = 'bk-overlay';
    overlay.id = 'bk-overlay';
    overlay.addEventListener('click', close);

    var panel = document.createElement('div');
    panel.className = 'bk-panel';
    panel.id = 'bk-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'bk-header';
    header.innerHTML =
      '<div class="bk-header-left">' +
        '<button class="bk-header-back" id="bk-back" aria-label="Back">←</button>' +
        '<span class="bk-header-title" id="bk-header-title">Book Your Stay</span>' +
      '</div>' +
      '<div class="bk-steps" id="bk-steps">' +
        '<span class="bk-step-dot active"></span><span class="bk-step-dot"></span><span class="bk-step-dot"></span><span class="bk-step-dot"></span>' +
        '<span class="bk-step-dot"></span><span class="bk-step-dot"></span><span class="bk-step-dot"></span><span class="bk-step-dot"></span>' +
      '</div>';
    panel.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.className = 'bk-body';
    body.id = 'bk-body';
    body.innerHTML = buildStep1() + buildStep2() + buildStep3() + buildStep4() + buildStep5() + buildStep6() + buildStep7() + buildStep8();
    panel.appendChild(body);

    // Footer
    var footer = document.createElement('div');
    footer.className = 'bk-footer';
    footer.id = 'bk-footer';
    footer.innerHTML =
      '<div class="bk-footer-left">' +
        '<span class="bk-footer-label" id="bk-footer-label">Estimated Total</span>' +
        '<span class="bk-footer-price" id="bk-footer-price">₹0</span>' +
      '</div>' +
      '<div class="bk-footer-actions">' +
        '<button class="bk-btn bk-btn-secondary" id="bk-skip">Skip</button>' +
        '<button class="bk-btn bk-btn-primary" id="bk-next">Continue</button>' +
      '</div>';
    panel.appendChild(footer);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Bind events
    document.getElementById('bk-back').addEventListener('click', prevStep);
    document.getElementById('bk-next').addEventListener('click', nextStep);
    document.getElementById('bk-skip').addEventListener('click', function() { advance(); });

    // Calendar bindings
    document.getElementById('bk-cal-prev').addEventListener('click', function() { shiftCal('', -1); });
    document.getElementById('bk-cal-next').addEventListener('click', function() { shiftCal('', 1); });
    document.getElementById('bk-cal-prev-out').addEventListener('click', function() { shiftCal('-out', -1); });
    document.getElementById('bk-cal-next-out').addEventListener('click', function() { shiftCal('-out', 1); });

    // Guest counters
    ['adults','children','rooms','pets'].forEach(function(f) {
      var m = document.getElementById('bk-' + f + '-minus');
      var p = document.getElementById('bk-' + f + '-plus');
      if (m) m.addEventListener('click', function() { adjGuest(f, -1); });
      if (p) p.addEventListener('click', function() { adjGuest(f, 1); });
    });

    // Payment
    var payBtn = document.getElementById('bk-pay-btn');
    if (payBtn) payBtn.addEventListener('click', processPayment);

    // Date inputs
    var di = document.getElementById('bk-checkin');
    var dout = document.getElementById('bk-checkout');
    if (di) di.addEventListener('click', function() { scrollToCal(); });
    if (dout) dout.addEventListener('click', function() { scrollToCal(); });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') close();
    });
  }

  function scrollToCal() {
    var cal = document.getElementById('bk-cal-wrap');
    if (cal) cal.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* === Step Builders === */
  function buildStep1() {
    return '<div class="bk-step active" data-step="1">' +
      '<div class="bk-step-label">Step 1</div>' +
      '<div class="bk-step-title">Where would you like to stay?</div>' +
      '<div class="bk-step-sub">Your destination is already selected — a luxury mountain retreat awaits.</div>' +
      '<div class="bk-dest-card">' +
        '<div class="bk-dest-map"></div>' +
        '<div class="bk-dest-info">' +
          '<div class="bk-dest-name">Flamingo aur Maina</div>' +
          '<div class="bk-dest-loc">Jibhi, Himachal Pradesh · 175123</div>' +
          '<div class="bk-dest-tags">' +
            '<span class="bk-dest-tag">✦ Boutique Stay</span>' +
            '<span class="bk-dest-tag">✦ Mountain Views</span>' +
            '<span class="bk-dest-tag">✦ Forest Setting</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function buildStep2() {
    var mn = today();
    var m = state.calMonth, y = state.calYear;
    var mOut = state.calMonthOut, yOut = state.calYearOut;
    return '<div class="bk-step" data-step="2">' +
      '<div class="bk-step-label">Step 2</div>' +
      '<div class="bk-step-title">When are you arriving?</div>' +
      '<div class="bk-step-sub">Select your check-in and check-out dates.</div>' +
      '<div class="bk-cal-wrap" id="bk-cal-wrap">' +
        '<div class="bk-cal"><div class="bk-cal-header"><button class="bk-cal-nav" id="bk-cal-prev">‹</button><span class="bk-cal-month" id="bk-cal-month">' + getMonthLabel(m, y) + '</span><button class="bk-cal-nav" id="bk-cal-next">›</button></div><div class="bk-cal-weekdays">' +
          '<span class="bk-cal-weekday">Sun</span><span class="bk-cal-weekday">Mon</span><span class="bk-cal-weekday">Tue</span><span class="bk-cal-weekday">Wed</span><span class="bk-cal-weekday">Thu</span><span class="bk-cal-weekday">Fri</span><span class="bk-cal-weekday">Sat</span>' +
        '</div><div class="bk-cal-grid" id="bk-cal-grid"></div></div>' +
        '<div class="bk-cal"><div class="bk-cal-header"><button class="bk-cal-nav" id="bk-cal-prev-out">‹</button><span class="bk-cal-month" id="bk-cal-month-out">' + getMonthLabel(mOut, yOut) + '</span><button class="bk-cal-nav" id="bk-cal-next-out">›</button></div><div class="bk-cal-weekdays">' +
          '<span class="bk-cal-weekday">Sun</span><span class="bk-cal-weekday">Mon</span><span class="bk-cal-weekday">Tue</span><span class="bk-cal-weekday">Wed</span><span class="bk-cal-weekday">Thu</span><span class="bk-cal-weekday">Fri</span><span class="bk-cal-weekday">Sat</span>' +
        '</div><div class="bk-cal-grid" id="bk-cal-grid-out"></div></div>' +
      '</div>' +
      '<div class="bk-cal-summary" id="bk-cal-summary" style="display:none">' +
        '<div class="bk-cal-summary-item"><span class="bk-cal-summary-label">Check-in</span><span class="bk-cal-summary-val" id="bk-summary-in">—</span></div>' +
        '<div class="bk-cal-summary-divider"></div>' +
        '<div class="bk-cal-summary-item"><span class="bk-cal-summary-label">Check-out</span><span class="bk-cal-summary-val" id="bk-summary-out">—</span></div>' +
        '<div class="bk-cal-summary-divider"></div>' +
        '<div class="bk-cal-summary-item"><span class="bk-cal-summary-label">Nights</span><span class="bk-cal-summary-val" id="bk-summary-nights">0</span></div>' +
      '</div>' +
    '</div>';
  }

  function buildStep3() {
    return '<div class="bk-step" data-step="3">' +
      '<div class="bk-step-label">Step 3</div>' +
      '<div class="bk-step-title">Who\'s travelling?</div>' +
      '<div class="bk-step-sub">Let us know your group size so we can recommend the perfect setup.</div>' +
      '<div class="bk-guest-selector">' +
        '<div class="bk-guest-row"><div class="bk-guest-info"><div class="bk-guest-label">Adults</div><div class="bk-guest-sub">Age 18+</div></div><div class="bk-counter"><button class="bk-counter-btn" id="bk-adults-minus">−</button><span class="bk-counter-val" id="bk-adults-val">' + state.adults + '</span><button class="bk-counter-btn" id="bk-adults-plus">+</button></div></div>' +
        '<div class="bk-guest-row"><div class="bk-guest-info"><div class="bk-guest-label">Children</div><div class="bk-guest-sub">Ages 2–12</div></div><div class="bk-counter"><button class="bk-counter-btn" id="bk-children-minus">−</button><span class="bk-counter-val" id="bk-children-val">' + state.children + '</span><button class="bk-counter-btn" id="bk-children-plus">+</button></div></div>' +
        '<div class="bk-guest-row"><div class="bk-guest-info"><div class="bk-guest-label">Rooms</div><div class="bk-guest-sub">How many rooms?</div></div><div class="bk-counter"><button class="bk-counter-btn" id="bk-rooms-minus">−</button><span class="bk-counter-val" id="bk-rooms-val">' + state.rooms + '</span><button class="bk-counter-btn" id="bk-rooms-plus">+</button></div></div>' +
        '<div class="bk-guest-row"><div class="bk-guest-info"><div class="bk-guest-label">Pets</div><div class="bk-guest-sub">Furry friends welcome</div></div><div class="bk-counter"><button class="bk-counter-btn" id="bk-pets-minus">−</button><span class="bk-counter-val" id="bk-pets-val">' + state.pets + '</span><button class="bk-counter-btn" id="bk-pets-plus">+</button></div></div>' +
      '</div>' +
    '</div>';
  }

  function buildStep4() {
    var html = '<div class="bk-step" data-step="4">' +
      '<div class="bk-step-label">Step 4</div>' +
      '<div class="bk-step-title">What brings you to the mountains?</div>' +
      '<div class="bk-step-sub">Choose your trip type — your recommendation will be tailored to you.</div>' +
      '<div class="bk-trip-grid">';
    for (var i = 0; i < TRIP_TYPES.length; i++) {
      var t = TRIP_TYPES[i];
      html += '<div class="bk-trip-card' + (state.tripType === t.id ? ' selected' : '') + '" data-trip="' + t.id + '">' +
        '<div class="bk-trip-card-glow"></div>' +
        '<span class="bk-trip-card-icon">' + t.icon + '</span>' +
        '<div class="bk-trip-card-label">' + t.label + '</div>' +
        '<div class="bk-trip-card-desc">' + t.desc + '</div>' +
      '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildStep5() {
    var trip = ROOM_DATA[state.tripType] || ROOM_DATA['Romantic Getaway'];
    var scores = trip.scores;
    var p = calcPrice();
    return '<div class="bk-step" data-step="5">' +
      '<div class="bk-step-label">AI Recommendation</div>' +
      '<div class="bk-step-title">Your perfect room awaits</div>' +
      '<div class="bk-step-sub">Based on your preferences, the AI Concierge recommends:</div>' +
      '<div class="bk-ai-rec">' +
        '<span class="bk-ai-badge">✦ Powered by AI · ' + state.tripType + '</span>' +
        '<div class="bk-ai-rec-main">' +
          '<div class="bk-ai-rec-image">' + trip.image + '</div>' +
          '<div class="bk-ai-rec-info">' +
            '<div class="bk-ai-rec-name">' + trip.room + '</div>' +
            '<div class="bk-ai-rec-why">' + getWhyText(state.tripType) + '</div>' +
            '<div class="bk-ai-scores" id="bk-ai-scores">' +
              '<div class="bk-ai-score"><span class="bk-ai-score-label">Mountain View</span><div class="bk-ai-score-bar"><div class="bk-ai-score-fill" style="width:0%" data-w="' + scores.mountain + '"></div></div><span class="bk-ai-score-val">' + scores.mountain + '%</span></div>' +
              '<div class="bk-ai-score"><span class="bk-ai-score-label">Privacy</span><div class="bk-ai-score-bar"><div class="bk-ai-score-fill" style="width:0%" data-w="' + scores.privacy + '"></div></div><span class="bk-ai-score-val">' + scores.privacy + '%</span></div>' +
              '<div class="bk-ai-score"><span class="bk-ai-score-label">Sunrise View</span><div class="bk-ai-score-bar"><div class="bk-ai-score-fill" style="width:0%" data-w="' + scores.sunrise + '"></div></div><span class="bk-ai-score-val">' + scores.sunrise + '%</span></div>' +
              '<div class="bk-ai-score"><span class="bk-ai-score-label">Work Friendly</span><div class="bk-ai-score-bar"><div class="bk-ai-score-fill" style="width:0%" data-w="' + scores.work + '"></div></div><span class="bk-ai-score-val">' + scores.work + '%</span></div>' +
              '<div class="bk-ai-score"><span class="bk-ai-score-label">Luxury</span><div class="bk-ai-score-bar"><div class="bk-ai-score-fill" style="width:0%" data-w="' + scores.luxury + '"></div></div><span class="bk-ai-score-val">' + scores.luxury + '%</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bk-ai-confidence"><span class="bk-ai-conf-label">Recommendation Confidence</span><span class="bk-ai-conf-stars">★★★★★</span></div>' +
      '</div>' +
    '</div>';
  }

  function getWhyText(type) {
    var map = {
      'Romantic Getaway': 'Intimate and serene — Maina 1 offers unmatched privacy with a balcony overlooking the forest, perfect for couples.',
      'Family Vacation': 'Spacious and welcoming — Flamingo 3 has two bedrooms, a living area, and enough space for the whole family to unwind.',
      'Work From Mountains': 'Quiet and connected — Maina 2 has a dedicated work corner with strong Wi-Fi and mountain views to inspire you.',
      'Adventure Trek': 'Rugged and ready — Flamingo 1 is the perfect basecamp for your Jibhi adventures, close to all trailheads.',
      'Solo Retreat': 'Peaceful and private — Maina 2 offers a cozy sanctuary for solo travellers seeking quiet and reflection.',
      'Friends Trip': 'Social and fun — Flamingo 1\'s duplex layout is perfect for friends travelling together with shared spaces.',
      'Wellness Escape': 'Harmonious and luxurious — Flamingo 3 with its open spaces and forest views creates the ideal wellness setting.'
    };
    return map[type] || 'Perfectly matched to your preferences — our AI recommends this room for an unforgettable stay.';
  }

  function buildStep6() {
    var html = '<div class="bk-step" data-step="6">' +
      '<div class="bk-step-label">Enhance Your Stay</div>' +
      '<div class="bk-step-title">Add experiences to your trip</div>' +
      '<div class="bk-step-sub">Optional handpicked experiences curated for your stay.</div>' +
      '<div class="bk-addon-grid">';
    for (var i = 0; i < ADDON_DATA.length; i++) {
      var a = ADDON_DATA[i];
      html += '<div class="bk-addon-card' + (state.addons[a.id] ? ' selected' : '') + '" data-addon="' + a.id + '">' +
        '<div class="bk-addon-icon">' + a.icon + '</div>' +
        '<div class="bk-addon-info"><div class="bk-addon-name">' + a.name + '</div><div class="bk-addon-price">₹' + a.price + '</div></div>' +
        '<button class="bk-addon-toggle' + (state.addons[a.id] ? ' on' : '') + '" data-addon-toggle="' + a.id + '"></button>' +
      '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildStep7() {
    var itin = getDefaultItinerary(state.tripType);
    var html = '<div class="bk-step" data-step="7">' +
      '<div class="bk-step-label">Your Itinerary</div>' +
      '<div class="bk-step-title">Your smart itinerary</div>' +
      '<div class="bk-step-sub">A personalised 3-day plan crafted by your AI Concierge.</div>' +
      '<div class="bk-itin">';
    for (var d = 0; d < itin.length; d++) {
      html += '<div class="bk-itin-day">' +
        '<div class="bk-itin-day-header"><span class="bk-itin-day-num">' + (d + 1) + '</span><span class="bk-itin-day-title">' + itin[d].title + '</span></div>' +
        '<div class="bk-itin-items">';
      for (var i = 0; i < itin[d].items.length; i++) {
        html += '<div class="bk-itin-item"><span class="bk-itin-item-icon">✦</span>' + itin[d].items[i] + '</div>';
      }
      html += '</div></div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildStep8() {
    var p = calcPrice();
    return '<div class="bk-step" data-step="8">' +
      '<div class="bk-step-label">Almost Done</div>' +
      '<div class="bk-step-title">Complete your booking</div>' +
      '<div class="bk-step-sub">Secure your stay with a quick payment.</div>' +
      '<div class="bk-pay-grid">' +
        '<div class="bk-pay-left">' +
          '<div class="bk-pay-summary">' +
            '<div class="bk-pay-row"><span>Room (' + (p.nights || 1) + ' nights × ₹' + p.baseRate + ')</span><span>₹' + p.roomTotal.toLocaleString('en-IN') + '</span></div>' +
            '<div class="bk-pay-row"><span>Add-ons</span><span>₹' + p.addonTotal.toLocaleString('en-IN') + '</span></div>' +
            '<div class="bk-pay-row"><span>Taxes (12%)</span><span>₹' + p.tax.toLocaleString('en-IN') + '</span></div>' +
            (p.discount > 0 ? '<div class="bk-pay-row" style="color:#22c55e"><span>Long Stay Discount (−8%)</span><span>−₹' + p.discount.toLocaleString('en-IN') + '</span></div>' : '') +
            (p.weekendSurcharge > 0 ? '<div class="bk-pay-row"><span>Weekend Surcharge</span><span>₹' + p.weekendSurcharge.toLocaleString('en-IN') + '</span></div>' : '') +
            '<div class="bk-pay-row total"><span>Total</span><span>₹' + p.total.toLocaleString('en-IN') + '</span></div>' +
          '</div>' +
          '<div class="bk-pay-progress"><div class="bk-pay-progress-bar"><div class="bk-pay-progress-fill" id="bk-pay-progress-fill" style="width:0%"></div></div><span class="bk-pay-progress-label" id="bk-pay-progress-label">0%</span></div>' +
          '<span class="bk-pay-badge">🔒 Secured with 256-bit encryption</span>' +
        '</div>' +
        '<div class="bk-pay-form">' +
          '<input class="bk-pay-input" placeholder="Full Name" id="bk-pay-name">' +
          '<input class="bk-pay-input" placeholder="Email Address" type="email" id="bk-pay-email">' +
          '<input class="bk-pay-input" placeholder="Phone Number" type="tel" id="bk-pay-phone">' +
          '<input class="bk-pay-input" placeholder="Card Number" id="bk-pay-card">' +
          '<div class="bk-pay-row-inputs"><input class="bk-pay-input" placeholder="MM/YY" id="bk-pay-expiry"><input class="bk-pay-input" placeholder="CVV" id="bk-pay-cvv"></div>' +
          '<button class="bk-btn bk-btn-primary" id="bk-pay-btn" style="margin-top:6px;width:100%">Pay ₹' + p.total.toLocaleString('en-IN') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* === Step Management === */
  var STEP_TITLES = [
    'Book Your Stay', 'Select Dates', 'Who\'s Travelling',
    'Trip Type', 'AI Recommendation', 'Enhance Your Stay',
    'Your Itinerary', 'Secure Payment'
  ];

  function goToStep(n) {
    state.step = n;
    var body = document.getElementById('bk-body');
    if (!body) return;
    document.querySelectorAll('.bk-step').forEach(function(s) { s.classList.remove('active'); });
    var target = document.querySelector('.bk-step[data-step="' + n + '"]');
    if (!target) return;
    target.classList.add('active');
    document.getElementById('bk-header-title').textContent = STEP_TITLES[n - 1] || 'Book Your Stay';
    // Update dots
    var dots = document.querySelectorAll('.bk-step-dot');
    dots.forEach(function(d, i) {
      d.className = 'bk-step-dot';
      if (i + 1 < n) d.classList.add('done');
      else if (i + 1 === n) d.classList.add('active');
    });
    // Back button
    var back = document.getElementById('bk-back');
    if (back) back.classList.toggle('show', n > 1);
    // Skip button visibility
    var skip = document.getElementById('bk-skip');
    if (skip) {
      if (n === 5 || n === 6 || n === 7 || n === 8) {
        skip.style.display = 'none';
      } else {
        skip.style.display = '';
      }
    }
    // Next button text
    var next = document.getElementById('bk-next');
    if (next) {
      if (n === 4 && state.tripType) next.textContent = 'Get AI Recommendation →';
      else if (n === 7) next.textContent = 'Proceed to Payment →';
      else if (n === 5) next.textContent = 'Continue →';
      else if (n === 8) next.textContent = '✨ Confirm Booking';
      else next.textContent = 'Continue →';
    }
    // Refresh step-specific content
    if (n === 2) { renderCalendar(''); renderCalendar('-out'); updateCalSummary(); }
    if (n === 5) animateScores();
    if (n === 6) refreshAddons();
    if (n === 8) refreshPayment();
    updatePrice();
    body.scrollTop = 0;
  }

  function animateScores() {
    setTimeout(function() {
      document.querySelectorAll('#bk-ai-scores .bk-ai-score-fill').forEach(function(el) {
        el.style.width = el.getAttribute('data-w') + '%';
      });
    }, 300);
  }

  function nextStep() {
    if (state.step === 1) advance();
    else if (state.step === 2) { if (state.checkIn && state.checkOut) advance(); else { shakeCal(); return; } }
    else if (state.step === 3) advance();
    else if (state.step === 4) { if (!state.tripType) { shakeTrip(); return; } advance(); }
    else if (state.step === 5) advance();
    else if (state.step === 6) advance();
    else if (state.step === 7) advance();
    else if (state.step === 8) processPayment();
  }

  function prevStep() {
    if (state.step > 1) goToStep(state.step - 1);
  }

  function advance() {
    if (state.step < 8) goToStep(state.step + 1);
  }

  function shakeCal() {
    var wrap = document.getElementById('bk-cal-wrap');
    if (wrap) { wrap.style.animation = 'shake 0.4s ease'; setTimeout(function(){ wrap.style.animation = ''; }, 500); }
  }

  function shakeTrip() {
    var grid = document.querySelector('.bk-trip-grid');
    if (grid) { grid.style.animation = 'shake 0.4s ease'; setTimeout(function(){ grid.style.animation = ''; }, 500); }
  }

  /* === Calendar === */
  function getMonthLabel(m, y) {
    return new Date(y, m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  function shiftCal(prefix, dir) {
    if (prefix === '-out') {
      state.calMonthOut += dir;
      if (state.calMonthOut < 0) { state.calMonthOut = 11; state.calYearOut--; }
      if (state.calMonthOut > 11) { state.calMonthOut = 0; state.calYearOut++; }
      renderCalendar('-out');
    } else {
      state.calMonth += dir;
      if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
      if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
      renderCalendar('');
    }
  }

  function renderCalendar(prefix) {
    var p = prefix || '';
    var grid = document.getElementById('bk-cal-grid' + p);
    var monthEl = document.getElementById('bk-cal-month' + p);
    var isOut = p === '-out';
    var y = isOut ? state.calYearOut : state.calYear;
    var m = isOut ? state.calMonthOut : state.calMonth;
    if (!grid || !monthEl) return;
    monthEl.textContent = getMonthLabel(m, y);
    var first = getFirstDay(y, m);
    var days = getDaysInMonth(y, m);
    var minDate = isOut ? (state.checkIn ? new Date(state.checkIn) : today()) : today();
    // For check-out, ensure minDate is checkIn + 1
    if (isOut && state.checkIn) {
      minDate = new Date(state.checkIn);
      minDate.setDate(minDate.getDate() + 1);
    }
    var html = '';
    for (var i = 0; i < first; i++) { html += '<button class="bk-cal-day other" disabled></button>'; }
    for (var d = 1; d <= days; d++) {
      var date = new Date(y, m, d);
      var disabled = isBeforeDay(date, minDate) ? ' disabled' : '';
      var sel = '';
      var ref = isOut ? state.checkOut : state.checkIn;
      if (ref && isSameDay(date, ref)) sel = ' selected';
      var cls = 'bk-cal-day' + sel + disabled;
      if (isOut && state.checkIn && !disabled && state.checkIn && date > state.checkIn && date <= (state.checkOut || state.checkIn)) cls += ' in-range';
      if (!isOut && state.checkIn && !disabled && state.checkOut && date >= state.checkIn && date <= state.checkOut) cls += ' in-range';
      var wd = date.getDay();
      if (wd === 0 || wd === 6) cls += ' weekend';
      if (isSameDay(date, today())) cls += ' today';
      html += '<button class="' + cls + '" data-year="' + y + '" data-month="' + m + '" data-day="' + d + '">' + d + '</button>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.bk-cal-day:not(.disabled):not(.other)').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var day = parseInt(btn.getAttribute('data-day'));
        var year = parseInt(btn.getAttribute('data-year'));
        var month = parseInt(btn.getAttribute('data-month'));
        var date = new Date(year, month, day);
        if (isOut) {
          state.checkOut = date;
          renderCalendar('-out');
        } else {
          state.checkIn = date;
          if (!state.checkOut || isBeforeDay(state.checkOut, date) || isSameDay(state.checkOut, date)) {
            var next = new Date(date);
            next.setDate(next.getDate() + 1);
            state.checkOut = next;
            state.calYearOut = next.getFullYear();
            state.calMonthOut = next.getMonth();
            renderCalendar('-out');
          }
          renderCalendar('');
        }
        updateCalSummary();
        updatePrice();
      });
    });
    // Prev/next buttons
    var prevBtn = document.getElementById('bk-cal-prev' + p);
    var nextBtn = document.getElementById('bk-cal-next' + p);
    if (prevBtn) {
      if (isOut) {
        var canPrev = y > (state.checkIn ? state.checkIn.getFullYear() : today().getFullYear()) || (y === (state.checkIn ? state.checkIn.getFullYear() : today().getFullYear()) && m > (state.checkIn ? state.checkIn.getMonth() : today().getMonth()));
        prevBtn.disabled = !canPrev;
      } else {
        prevBtn.disabled = y <= today().getFullYear() && m <= today().getMonth();
      }
    }
    if (nextBtn) nextBtn.disabled = false;
  }

  function updateCalSummary() {
    var summary = document.getElementById('bk-cal-summary');
    if (!summary) return;
    if (state.checkIn && state.checkOut) {
      summary.style.display = 'flex';
      document.getElementById('bk-summary-in').textContent = formatDateShort(state.checkIn);
      document.getElementById('bk-summary-out').textContent = formatDateShort(state.checkOut);
      document.getElementById('bk-summary-nights').textContent = getNights();
    } else {
      summary.style.display = 'none';
    }
  }

  /* === Guest Counters === */
  function adjGuest(field, dir) {
    var limits = { adults: [1,20], children: [0,10], rooms: [1,10], pets: [0,5] };
    var lim = limits[field] || [0, 20];
    if (dir > 0 && state[field] < lim[1]) state[field]++;
    else if (dir < 0 && state[field] > lim[0]) state[field]--;
    var el = document.getElementById('bk-' + field + '-val');
    if (el) el.textContent = state[field];
    updatePrice();
  }

  /* === Trip Type === */
  function bindTripCards() {
    var container = document.getElementById('bk-trip-cards') || document.querySelector('.bk-trip-cards');
    if (!container) {
      document.querySelectorAll('.bk-trip-card').forEach(function(card) {
        card.addEventListener('click', function() {
          document.querySelectorAll('.bk-trip-card').forEach(function(c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          state.tripType = card.getAttribute('data-trip');
          var next = document.getElementById('bk-next');
          if (next) next.textContent = 'Get AI Recommendation →';
        });
      });
      return;
    }
    container.addEventListener('click', function(e) {
      var card = e.target.closest('.bk-trip-card');
      if (!card) return;
      container.querySelectorAll('.bk-trip-card').forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      state.tripType = card.getAttribute('data-trip');
      var next = document.getElementById('bk-next');
      if (next) next.textContent = 'Get AI Recommendation →';
    });
  }

  /* === Add-ons === */
  function refreshAddons() {
    document.querySelectorAll('.bk-addon-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.bk-addon-toggle')) return;
        var id = card.getAttribute('data-addon');
        state.addons[id] = !state.addons[id];
        card.classList.toggle('selected');
        var toggle = card.querySelector('.bk-addon-toggle');
        if (toggle) toggle.classList.toggle('on');
        updatePrice();
      });
    });
    document.querySelectorAll('.bk-addon-toggle').forEach(function(tog) {
      tog.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = tog.getAttribute('data-addon-toggle');
        state.addons[id] = !state.addons[id];
        tog.classList.toggle('on');
        var card = tog.closest('.bk-addon-card');
        if (card) card.classList.toggle('selected');
        updatePrice();
      });
    });
  }

  /* === Payment === */
  var payStep = 0;

  function refreshPayment() {
    payStep = 0;
    updatePayProgress();
  }

  function updatePayProgress() {
    var fill = document.getElementById('bk-pay-progress-fill');
    var label = document.getElementById('bk-pay-progress-label');
    if (!fill || !label) return;
    var vals = [0, 25, 50, 75, 100];
    var pct = vals[Math.min(payStep, 4)];
    fill.style.width = pct + '%';
    label.textContent = pct + '%';
  }

  function processPayment() {
    if (payStep >= 5) return;
    payStep++;
    updatePayProgress();
    if (payStep < 4) return;
    // Complete payment
    var panel = document.getElementById('bk-panel');
    var body = document.getElementById('bk-body');
    var footer = document.getElementById('bk-footer');
    var header = document.getElementById('bk-header-title');
    if (header) header.textContent = 'Booking Confirmed';
    if (body) {
      body.innerHTML = '<div class="bk-success">' +
        '<div class="bk-success-icon">✓</div>' +
        '<div class="bk-success-title">Your stay is confirmed!</div>' +
        '<div class="bk-success-sub">A confirmation email will be sent to your inbox with all the details. We can\'t wait to welcome you to Flamingo aur Maina.</div>' +
        '<div class="bk-success-id">Booking #FAM-' + Math.random().toString(36).substring(2,8).toUpperCase() + '</div>' +
      '</div>';
    }
    if (footer) {
      footer.innerHTML = '<div style="width:100%;text-align:center"><button class="bk-btn bk-btn-primary" id="bk-done" style="margin:0 auto">Done</button></div>';
      document.getElementById('bk-done').addEventListener('click', close);
    }
  }

  /* === Price === */
  function updatePrice() {
    var el = document.getElementById('bk-footer-price');
    if (!el) return;
    var p = calcPrice();
    el.textContent = '₹' + (p.total || 0).toLocaleString('en-IN');
  }

  /* === Open / Close === */
  function open() {
    var overlay = document.getElementById('bk-overlay');
    var panel = document.getElementById('bk-panel');
    if (overlay) overlay.classList.add('open');
    if (panel) panel.classList.add('open');
    goToStep(state.step);
    // Rebind dynamic events
    setTimeout(function() {
      renderCalendar('');
      renderCalendar('-out');
      updateCalSummary();
      bindTripCards();
    }, 100);
  }

  function close() {
    var overlay = document.getElementById('bk-overlay');
    var panel = document.getElementById('bk-panel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
    // Reset payment if on success
    var header = document.getElementById('bk-header-title');
    if (header && header.textContent === 'Booking Confirmed') {
      payStep = 0;
      state.step = 1;
      state.tripType = null;
      state.checkIn = null;
      state.checkOut = null;
      state.addons = {};
      // Rebuild panel body
      var body = document.getElementById('bk-body');
      var footer = document.getElementById('bk-footer');
      if (body) {
        body.innerHTML = buildStep1() + buildStep2() + buildStep3() + buildStep4() + buildStep5() + buildStep6() + buildStep7() + buildStep8();
        // Re-bind next/skip
        document.getElementById('bk-next').addEventListener('click', nextStep);
        document.getElementById('bk-skip').addEventListener('click', function() { advance(); });
        document.getElementById('bk-back').addEventListener('click', prevStep);
        document.getElementById('bk-cal-prev').addEventListener('click', function() { shiftCal('', -1); });
        document.getElementById('bk-cal-next').addEventListener('click', function() { shiftCal('', 1); });
        document.getElementById('bk-cal-prev-out').addEventListener('click', function() { shiftCal('-out', -1); });
        document.getElementById('bk-cal-next-out').addEventListener('click', function() { shiftCal('-out', 1); });
        ['adults','children','rooms','pets'].forEach(function(f) {
          var m = document.getElementById('bk-' + f + '-minus');
          var p = document.getElementById('bk-' + f + '-plus');
          if (m) m.addEventListener('click', function() { adjGuest(f, -1); });
          if (p) p.addEventListener('click', function() { adjGuest(f, 1); });
        });
        var payBtn = document.getElementById('bk-pay-btn');
        if (payBtn) payBtn.addEventListener('click', processPayment);
        var di = document.getElementById('bk-checkin');
        var dout = document.getElementById('bk-checkout');
        if (di) di.addEventListener('click', function() { scrollToCal(); });
        if (dout) dout.addEventListener('click', function() { scrollToCal(); });
      }
      if (footer) {
        footer.innerHTML =
          '<div class="bk-footer-left">' +
            '<span class="bk-footer-label">Estimated Total</span>' +
            '<span class="bk-footer-price" id="bk-footer-price">₹0</span>' +
          '</div>' +
          '<div class="bk-footer-actions">' +
            '<button class="bk-btn bk-btn-secondary" id="bk-skip">Skip</button>' +
            '<button class="bk-btn bk-btn-primary" id="bk-next">Continue</button>' +
          '</div>';
        document.getElementById('bk-next').addEventListener('click', nextStep);
        document.getElementById('bk-skip').addEventListener('click', function() { advance(); });
      }
    }
  }

  /* === Init === */
  function init() {
    if (document.getElementById('bk-trigger')) return;
    buildTrigger();
    buildPanel();
  }

  window.openBookingModal = open;
  window.closeBookingModal = close;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
