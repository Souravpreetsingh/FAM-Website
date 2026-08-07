(function () {
  'use strict';

  var isOpen = false;
  var hasLoaded = false;
  var knowledgeBase = [];
  var kbReady = false;

  var fallbackMsg = "I'm sorry, I don't have that information yet. Please contact our Property Manager at 98765 75673 or email flamingoaurmaina@gmail.com. We'll be happy to help.";

  var listenersRegistered = false;

  var actionCards = [
    { id:'rec-room', icon:'🏡', label:'Rooms', desc:'Find your perfect stay' },
    { id:'plan-trip', icon:'🗓️', label:'Trip', desc:'Plan your itinerary' },
    { id:'attractions', icon:'📍', label:'Explore', desc:'Nearby places' },
    { id:'amenities', icon:'🚿', label:'Amenities', desc:'What we offer' },
    { id:'contact', icon:'📞', label:'Contact', desc:'Get in touch' },
    { id:'wifi', icon:'📶', label:'Wi-Fi', desc:'Stay connected' },
    { id:'bonfire', icon:'🔥', label:'Bonfire', desc:'Evening vibes' },
    { id:'cafe', icon:'☕', label:'Cafe', desc:'Menu & dining' }
  ];

  var welcomeText =
    '<div style="font-family:\'Playfair Display\',serif;font-size:16px;font-weight:600;color:#0a341d;margin-bottom:6px">Good to see you.</div>' +
    '<div style="font-family:\'Inter\',sans-serif;font-size:13px;color:#414942;line-height:1.6;margin-bottom:10px">I\'m your FAM concierge. Ask me anything or choose a quick action below.</div>';

  /* === Load Knowledge Base === */
  function getKnowledgeBasePath() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src.indexOf('concierge.js') !== -1) {
        return src.replace('concierge.js', 'famKnowledgeBase.json');
      }
    }
    return 'js/famKnowledgeBase.json';
  }

  function loadKnowledgeBase(callback) {
    var path = getKnowledgeBasePath();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          knowledgeBase = JSON.parse(xhr.responseText);
          kbReady = true;
        } catch (e) {
          knowledgeBase = [];
        }
      }
      if (callback) callback();
    };
    xhr.onerror = function () {
      if (callback) callback();
    };
    xhr.send();
  }

  /* === Time === */
  function getTimestamp() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function smoothScroll(el) {
    var target = el.scrollTopMax !== undefined ? el.scrollTopMax : el.scrollHeight - el.clientHeight;
    var start = el.scrollTop;
    var diff = target - start;
    var duration = 300;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      el.scrollTop = start + diff * ease;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* === Matching === */
  function tokenize(str) {
    return str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  }

  function computeScore(queryTokens, keywordList) {
    var score = 0;
    var matched = {};
    for (var t = 0; t < queryTokens.length; t++) {
      var qt = queryTokens[t];
      for (var k = 0; k < keywordList.length; k++) {
        var kw = keywordList[k].toLowerCase();
        if (matched[kw]) continue;
        if (qt === kw) {
          score += 3;
          matched[kw] = true;
        } else if (kw.indexOf(qt) === 0 || qt.indexOf(kw) === 0) {
          score += 2;
          matched[kw] = true;
        } else if (kw.indexOf(qt) > 0 || qt.indexOf(kw) > 0) {
          score += 1;
          matched[kw] = true;
        }
      }
    }
    return score;
  }

  function findBestMatch(query) {
    if (!kbReady || !knowledgeBase.length) return null;
    var tokens = tokenize(query);
    if (!tokens.length) return null;
    var bestScore = 0;
    var bestEntry = null;
    for (var i = 0; i < knowledgeBase.length; i++) {
      var entry = knowledgeBase[i];
      var score = computeScore(tokens, entry.keywords);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
    return bestScore >= 1 ? bestEntry : null;
  }

  function formatAnswer(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  /* === Magnetic Button === */
  function initMagnetic(btn) {
    var bound = btn.getBoundingClientRect();
    var cx = bound.left + bound.width / 2;
    var cy = bound.top + bound.height / 2;
    function move(e) {
      var dx = e.clientX - cx;
      var dy = e.clientY - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 120) { btn.style.transform = ''; return; }
      var strength = 0.25;
      btn.style.transform = 'translate(' + (dx * strength) + 'px, ' + (dy * strength) + 'px) scale(1.08)';
    }
    function reset() { btn.style.transform = ''; }
    btn.addEventListener('mousemove', move, { passive: true });
    btn.addEventListener('mouseleave', reset, { passive: true });
  }

  function createSparkle() {
    var sparkle = document.createElement('div');
    sparkle.style.cssText = 'position:absolute;font-size:10px;color:#C9A86A;pointer-events:none;animation:cqSparkle 1.2s ease-out forwards;z-index:0;';
    sparkle.textContent = '✦';
    var btn = document.getElementById('concierge-btn');
    if (btn) {
      var a = Math.random() * Math.PI * 2;
      var r = 18 + Math.random() * 14;
      sparkle.style.left = (24 + Math.cos(a) * r) + 'px';
      sparkle.style.top = (24 + Math.sin(a) * r) + 'px';
      btn.appendChild(sparkle);
      setTimeout(function () { if (sparkle.parentNode) sparkle.remove(); }, 1200);
    }
  }

  /* === UI === */
  var sparkleInterval;

  function buildButton() {
    if (document.getElementById('concierge-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'concierge-btn';
    btn.id = 'concierge-btn';
    btn.setAttribute('aria-label', 'Open FAM Concierge');
    btn.innerHTML = '<span class="cq-btn-icon">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2a10 10 0 0 0-7.07 17.07L3 22l3.93-1.93A10 10 0 1 0 12 2z"/>' +
        '<path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>' +
        '<path d="M9 14c.83.67 1.95 1 3 1s2.17-.33 3-1"/>' +
      '</svg></span>';
    document.body.appendChild(btn);
    initMagnetic(btn);
    btn.addEventListener('click', toggle);
    sparkleInterval = setInterval(createSparkle, 6000);
  }

  function buildPanel() {
    if (document.getElementById('concierge-panel')) return;
    var panel = document.createElement('div');
    panel.className = 'concierge-panel';
    panel.id = 'concierge-panel';

    var loading = document.createElement('div');
    loading.className = 'concierge-loading';
    loading.id = 'concierge-loading';
    loading.innerHTML =
      '<div class="concierge-loading-icon">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 2a10 10 0 0 0-7.07 17.07L3 22l3.93-1.93A10 10 0 1 0 12 2z"/>' +
          '<path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>' +
          '<path d="M9 14c.83.67 1.95 1 3 1s2.17-.33 3-1"/>' +
        '</svg>' +
      '</div>' +
      '<div class="concierge-loading-label">Connecting you</div>' +
      '<div class="concierge-loading-bar"></div>';

    var header = document.createElement('div');
    header.className = 'concierge-header';
    header.innerHTML =
      '<div class="cq-avatar">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 2a10 10 0 0 0-7.07 17.07L3 22l3.93-1.93A10 10 0 1 0 12 2z"/>' +
          '<path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>' +
          '<path d="M9 14c.83.67 1.95 1 3 1s2.17-.33 3-1"/>' +
        '</svg>' +
      '</div>' +
      '<div class="concierge-header-text">' +
        '<div class="concierge-header-title">FAM Concierge</div>' +
        '<div class="concierge-header-sub">' +
          '<span class="concierge-online-dot"></span>Online - Ask me anything' +
        '</div>' +
      '</div>' +
      '<button class="concierge-close" id="concierge-close" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';

    var messages = document.createElement('div');
    messages.className = 'concierge-messages';
    messages.id = 'concierge-messages';

    var welcome = document.createElement('div');
    welcome.className = 'cq-msg-wrapper bot';
    welcome.id = 'concierge-welcome';
    welcome.style.display = 'none';
    var welcomeBubble = document.createElement('div');
    welcomeBubble.className = 'cq-msg bot';
    welcomeBubble.innerHTML = welcomeText;
    var welcomeTime = document.createElement('div');
    welcomeTime.className = 'cq-time';
    welcomeTime.textContent = getTimestamp();
    welcome.appendChild(welcomeBubble);
    welcome.appendChild(welcomeTime);

    var typing = document.createElement('div');
    typing.className = 'cq-typing';
    typing.id = 'concierge-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    messages.appendChild(welcome);
    messages.appendChild(typing);

    var actions = document.createElement('div');
    actions.className = 'cq-actions-grid';
    actions.id = 'concierge-actions';
    actions.style.display = 'none';
    actionCards.forEach(function (c) {
      var card = document.createElement('button');
      card.className = 'cq-action-card';
      card.setAttribute('data-id', c.id);
      card.innerHTML = '<span class="cq-action-icon">' + c.icon + '</span>' + c.label;
      card.addEventListener('click', function () { handleAction(c.id); });
      actions.appendChild(card);
    });

    var inputArea = document.createElement('div');
    inputArea.className = 'concierge-input-area';
    inputArea.id = 'concierge-input-area';
    inputArea.style.display = 'none';
    inputArea.innerHTML =
      '<input type="text" class="concierge-input" id="concierge-input" placeholder="Ask anything about FAM..." autocomplete="off">' +
      '<button class="concierge-send" id="concierge-send" aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>';

    var footer = document.createElement('div');
    footer.className = 'concierge-footer';
    footer.textContent = 'FAM Concierge · Luxury Mountain Retreat';

    panel.appendChild(loading);
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(actions);
    panel.appendChild(inputArea);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    document.getElementById('concierge-close').addEventListener('click', close);
    document.getElementById('concierge-send').addEventListener('click', send);
    document.getElementById('concierge-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') send();
    });
  }

  function showWelcome() {
    var welcome = document.getElementById('concierge-welcome');
    var actions = document.getElementById('concierge-actions');
    var inputArea = document.getElementById('concierge-input-area');
    if (welcome) welcome.style.display = 'flex';
    if (actions) actions.style.display = 'grid';
    if (inputArea) inputArea.style.display = 'flex';
    var msgs = document.getElementById('concierge-messages');
    if (msgs) smoothScroll(msgs);
  }

  function toggle() {
    if (isOpen) close(); else open();
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    var panel = document.getElementById('concierge-panel');
    panel.classList.add('open');

    if (!hasLoaded) {
      setTimeout(function () {
        var loading = document.getElementById('concierge-loading');
        if (loading) loading.classList.add('hide');
        setTimeout(function () {
          if (loading) loading.style.display = 'none';
          showWelcome();
          hasLoaded = true;
          var inp = document.getElementById('concierge-input');
          if (inp) inp.focus();
        }, 500);
      }, 1000);
    } else {
      var inp = document.getElementById('concierge-input');
      setTimeout(function () { if (inp) inp.focus(); }, 350);
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.getElementById('concierge-panel').classList.remove('open');
    var btn = document.getElementById('concierge-btn');
    if (btn) btn.focus();
  }

  function addBotMessage(text) {
    var msgs = document.getElementById('concierge-messages');
    var wrapper = document.createElement('div');
    wrapper.className = 'cq-msg-wrapper bot';
    var bubble = document.createElement('div');
    bubble.className = 'cq-msg bot';
    bubble.innerHTML = text;
    var time = document.createElement('div');
    time.className = 'cq-time';
    time.textContent = getTimestamp();
    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    msgs.appendChild(wrapper);
    smoothScroll(msgs);
  }

  function addUserMessage(text) {
    var msgs = document.getElementById('concierge-messages');
    var wrapper = document.createElement('div');
    wrapper.className = 'cq-msg-wrapper user';
    var bubble = document.createElement('div');
    bubble.className = 'cq-msg user';
    bubble.textContent = text;
    var time = document.createElement('div');
    time.className = 'cq-time';
    time.textContent = getTimestamp();
    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    msgs.appendChild(wrapper);
    smoothScroll(msgs);
  }

  function send() {
    var inp = document.getElementById('concierge-input');
    var text = inp.value.trim();
    if (!text) return;
    inp.value = '';

    addUserMessage(text);

    var typing = document.getElementById('concierge-typing');
    typing.classList.add('show');
    var msgs = document.getElementById('concierge-messages');
    smoothScroll(msgs);

    var delay = 600 + Math.random() * 600;

    setTimeout(function () {
      typing.classList.remove('show');
      if (!kbReady && knowledgeBase.length === 0) {
        addBotMessage(fallbackMsg);
        return;
      }
      var match = findBestMatch(text);
      if (match) {
        addBotMessage(formatAnswer(match.answer));
      } else {
        addBotMessage(fallbackMsg);
      }
    }, delay);
  }

  /* === Rich Response Builders === */
  function buildRecommendRoomHTML() {
    return '<div class="cq-rec-title">Recommendations by traveller type:</div>' +
      '<div class="cq-rec-grid">' +
        '<div class="cq-rec-card"><div class="cq-rec-label">Couple</div><div class="cq-rec-room">Maina 1</div><div class="cq-rec-type">Private · 2 Guests</div><div class="cq-rec-price">₹2,500 / night</div><a href="/pages/booking.html?room=maina-1" class="cq-rec-btn">Book →</a></div>' +
        '<div class="cq-rec-card"><div class="cq-rec-label">Family</div><div class="cq-rec-room">Flamingo 3</div><div class="cq-rec-type">Duplex · 4 Guests</div><div class="cq-rec-price">₹6,000 / night</div><a href="/pages/booking.html?room=flamingo-3" class="cq-rec-btn">Book →</a></div>' +
        '<div class="cq-rec-card"><div class="cq-rec-label">Friends</div><div class="cq-rec-room">Flamingo 1</div><div class="cq-rec-type">Duplex · 4 Guests</div><div class="cq-rec-price">₹6,000 / night</div><a href="/pages/booking.html?room=flamingo-1" class="cq-rec-btn">Book →</a></div>' +
        '<div class="cq-rec-card"><div class="cq-rec-label">Solo</div><div class="cq-rec-room">Maina 2</div><div class="cq-rec-type">Private · 2 Guests</div><div class="cq-rec-price">₹2,000 / night</div><a href="/pages/booking.html?room=maina-2" class="cq-rec-btn">Book →</a></div>' +
      '</div>';
  }

  function buildTripPlannerHTML() {
    return '<div class="cq-trip-title">3-Day Jibhi Itinerary</div>' +
      '<div class="cq-trip-day"><div class="cq-trip-day-label">Day 1 — Arrival</div><div>Check in, evening walk to Jibhi Waterfall. Bonfire night at FAM.</div></div>' +
      '<div class="cq-trip-day"><div class="cq-trip-day-label">Day 2 — Jalori Pass</div><div>Drive 15 km to Jalori Pass. Trek 2 km to Serolsar Lake. Evening tea.</div></div>' +
      '<div class="cq-trip-day"><div class="cq-trip-day-label">Day 3 — Explore & Depart</div><div>Visit Chehni Kothi tower & Mini Thailand. Depart after lunch.</div></div>' +
      '<div class="cq-trip-detail"><strong>Est. Budget:</strong> ₹12,000–₹15,000 (2 nights + food + travel)</div>' +
      '<a href="/pages/rooms" class="cq-rec-btn">Book Now →</a>';
  }

  function buildAttractionsHTML() {
    var cards = [
      { name:'Jibhi Waterfall', dist:'500 m · 5 min walk', desc:'Closest nature escape from FAM. Beautiful year-round cascade.' },
      { name:'Jalori Pass', dist:'15 km · 45 min drive', desc:'At 3,120 m, panoramic Himalayan views. Best Mar–Jun, Sep–Nov.' },
      { name:'Serolsar Lake', dist:'2 km trek from Jalori Pass', desc:'Alpine lake through oak and rhododendron forests. Best May–Oct.' },
      { name:'Chehni Kothi', dist:'8 km · 25 min drive', desc:'Ancient tower with historic architecture in a heritage village.' },
      { name:'Mini Thailand', dist:'2 km · 10 min drive', desc:'Hidden riverside paradise with crystal-blue waters.' }
    ];
    var html = '<div class="cq-rec-title">Places to Explore Near FAM</div><div class="cq-attractions">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var img = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=80&fit=crop&q=60';
      html += '<div class="cq-attr-card">' +
        '<div class="cq-attr-img" style="background-image:url(' + img + ')"></div>' +
        '<div class="cq-attr-info">' +
          '<div class="cq-attr-name">' + c.name + '</div>' +
          '<div class="cq-attr-meta">' + c.dist + '</div>' +
          '<div class="cq-attr-desc">' + c.desc + '</div>' +
        '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildAmenitiesHTML() {
    var items = [
      'High-Speed Wi-Fi', 'Heater', 'Electric Blankets',
      'Bonfire', 'Laundry (On Demand)', 'Ironing (On Demand)',
      'Cab Service (On Demand)', 'Luggage Assistance', 'Trek Guide (On Demand)'
    ];
    var html = '<div class="cq-rec-title">All Amenities at FAM</div><div class="cq-amenities">';
    for (var i = 0; i < items.length; i++) {
      html += '<div class="cq-amenity-item">' + items[i] + '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildContactHTML() {
    return '<div class="cq-rec-title">Get in Touch</div><div class="cq-contact">' +
      '<div class="cq-contact-row"><span class="cq-contact-lbl">Property Manager</span><span class="cq-contact-val">98765 75673</span></div>' +
      '<div class="cq-contact-row"><span class="cq-contact-lbl">Founder</span><span class="cq-contact-val">98773 81864</span></div>' +
      '<div class="cq-contact-row"><span class="cq-contact-lbl">Email</span><span class="cq-contact-val">flamingoaurmaina@gmail.com</span></div>' +
      '<div class="cq-contact-addr">Opposite Forest Rest House, Rashala, Jibhi, Himachal Pradesh 175123</div>' +
      '<div class="cq-contact-btns">' +
        '<a href="tel:9876575673" class="cq-contact-btn">Call</a>' +
        '<a href="mailto:flamingoaurmaina@gmail.com" class="cq-contact-btn">Email</a>' +
        '<a href="https://www.google.com/maps?q=31.5787944,77.3668959" target="_blank" class="cq-contact-btn">Directions</a>' +
      '</div></div>';
  }

  function respondWithDelay(responseFn) {
    var typing = document.getElementById('concierge-typing');
    typing.classList.add('show');
    var msgs = document.getElementById('concierge-messages');
    smoothScroll(msgs);
    var delay = 600 + Math.random() * 600;
    setTimeout(function () {
      typing.classList.remove('show');
      addBotMessage(responseFn());
    }, delay);
  }

  /* === Action Handler === */
  var actionMap = {
    'rec-room': function () {
      addUserMessage('Recommend a room');
      respondWithDelay(buildRecommendRoomHTML);
    },
    'plan-trip': function () {
      addUserMessage('Plan my trip');
      respondWithDelay(buildTripPlannerHTML);
    },
    'attractions': function () {
      addUserMessage('Nearby attractions');
      respondWithDelay(buildAttractionsHTML);
    },
    'amenities': function () {
      addUserMessage('Amenities');
      respondWithDelay(buildAmenitiesHTML);
    },
    'contact': function () {
      addUserMessage('Contact info');
      respondWithDelay(buildContactHTML);
    },
    'wifi': function () {
      respondWithDelay(function () {
        return 'Yes! We provide high-speed Wi-Fi throughout the property, perfect for remote work, streaming, and video calls.';
      });
    },
    'bonfire': function () {
      respondWithDelay(function () {
        return 'Bonfire experiences are available on request during the evening, subject to weather conditions. A perfect way to end your day in the mountains.';
      });
    },
    'cafe': function () {
      respondWithDelay(function () {
        return 'Our boutique café serves freshly prepared comfort food, hot beverages, coffee, tea, snacks, and local favourites.';
      });
    }
  };

  function handleAction(id) {
    var fn = actionMap[id];
    if (fn) fn();
  }

  /* === Booking Modal === */
  var bookingModalOpen = false;
  var bookingModalInit = false;

  function initBookingModalEvents() {
    if (bookingModalInit) return;
    bookingModalInit = true;

    var closeBtn = document.getElementById('booking-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeBookingModal);

    var modal = document.getElementById('booking-modal');
    if (modal) {
      var overlay = modal.querySelector('.booking-modal-overlay');
      if (overlay) overlay.addEventListener('click', closeBookingModal);
    }

    var minus = document.getElementById('modal-guest-minus');
    var plus = document.getElementById('modal-guest-plus');
    var countEl = document.getElementById('modal-guest-count');

    if (minus && countEl) {
      minus.addEventListener('click', function () {
        var v = parseInt(countEl.textContent, 10);
        if (v > 1) countEl.textContent = v - 1;
      });
    }

    if (plus && countEl) {
      plus.addEventListener('click', function () {
        var v = parseInt(countEl.textContent, 10);
        if (v < 20) countEl.textContent = v + 1;
      });
    }

    var cta = document.getElementById('modal-booking-cta');
    if (cta) {
      cta.addEventListener('click', function () {
        var ci = document.getElementById('modal-checkin');
        var co = document.getElementById('modal-checkout');
        var guests = document.getElementById('modal-guest-count');
        var params = [];
        if (ci && ci.value) params.push('checkin=' + encodeURIComponent(ci.value));
        if (co && co.value) params.push('checkout=' + encodeURIComponent(co.value));
        if (guests) params.push('guests=' + encodeURIComponent(guests.textContent));
        var qs = params.length ? '?' + params.join('&') : '';
        closeBookingModal();
        var url = '/pages/booking.html' + qs;
        if (typeof window.navigateTo === 'function') {
          setTimeout(function () { window.navigateTo(url); }, 350);
        } else {
          setTimeout(function () { window.location.href = url; }, 350);
        }
      });
    }
  }

  function openBookingModal() {
    if (typeof window.navigateTo === 'function') {
      window.navigateTo('/pages/booking.html');
    } else {
      window.location.href = '/pages/booking.html';
    }
  }

  function closeBookingModal() {
    var modal = document.getElementById('booking-modal');
    if (!modal || !bookingModalOpen) return;

    bookingModalOpen = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (history.state && history.state.bookingModal) {
      history.back();
    }
  }

  /* === Overlap Prevention === */
  function initOverlapPrevention() {
    if (window.innerWidth > 767) return;
    var ticking = false;

    function getCriticalSections() {
      var sectionIds = ['ai-trip-planner', 'tp-section'];
      var result = [];
      sectionIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) result.push(el);
      });
      document.querySelectorAll('section, div').forEach(function (el) {
        var text = el.textContent || '';
        if (text.indexOf('Find Your Perfect Stay') !== -1 && el.children.length > 2) {
          var section = el.closest('section') || el;
          if (result.indexOf(section) === -1) result.push(section);
        }
      });
      return result;
    }

    function onScroll() {
      var btn = document.getElementById('concierge-btn');
      if (!btn) { ticking = false; return; }

      var zone = window.innerWidth < 480 ? 150 : 130;
      var sections = getCriticalSections();
      var hide = false;

      for (var i = 0; i < sections.length; i++) {
        var rect = sections[i].getBoundingClientRect();
        if (rect.bottom > window.innerHeight - zone && rect.top < window.innerHeight) {
          hide = true;
          break;
        }
      }

      if (hide) { btn.classList.add('hide-overlap'); }
      else { btn.classList.remove('hide-overlap'); }

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    }, { passive: true });

    onScroll();

    window.addEventListener('resize', function () {
      onScroll();
    }, { passive: true });
  }

  function init() {
    if (document.getElementById('concierge-btn')) return;

    initOverlapPrevention();
    loadKnowledgeBase(function () {
      buildButton();
      buildPanel();
    });

    if (!listenersRegistered) {
      listenersRegistered = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) close();
        if (e.key === 'Escape' && bookingModalOpen) closeBookingModal();
      });
      document.addEventListener('click', function (e) {
        if (!isOpen) return;
        var panel = document.getElementById('concierge-panel');
        var btnEl = document.getElementById('concierge-btn');
        if (!panel || !btnEl) return;
        if (!panel.contains(e.target) && !btnEl.contains(e.target)) close();
      });
      window.addEventListener('popstate', function () {
        if (bookingModalOpen) {
          bookingModalOpen = false;
          var modal = document.getElementById('booking-modal');
          if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
          }
        }
      });
    }
  }

  // Re-init after SPA page transitions (concierge elements are removed from DOM)
  document.addEventListener('page:loaded', function () {
    clearInterval(sparkleInterval);
    if (isOpen) close();
    init();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
