(function () {
  'use strict';

  var FAM = window.FAM || {};
  window.FAM = FAM;

  function apiBase() {
    if (window.FAM_API_BASE) return window.FAM_API_BASE.replace(/\/auth$/, '');
    var host = window.location.hostname;
    var sameOriginHosts = ['localhost', '127.0.0.1', 'fam-website-wq2e.onrender.com'];
    if (sameOriginHosts.indexOf(host) !== -1) return '/api/v1';
    return 'https://fam-website-wq2e.onrender.com/api/v1';
  }

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (FAM.Auth && FAM.Auth.getAccessToken) {
      var token = FAM.Auth.getAccessToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }

  async function request(path, opts) {
    opts = opts || {};
    var config = { method: opts.method || 'GET', headers: authHeaders() };
    if (opts.body) config.body = JSON.stringify(opts.body);
    var res = await fetch(apiBase() + path, config);
    var json = null;
    try { json = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok || (json && json.success === false)) {
      var err = new Error((json && json.message) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return json ? json.data : null;
  }

  function ymd(d) {
    if (!d) return '';
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  FAM.Booking = {
    apiBase: apiBase,

    rooms: function (params) {
      var qs = '';
      if (params) {
        var parts = [];
        Object.keys(params).forEach(function (k) {
          if (params[k]) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
        });
        if (parts.length) qs = '?' + parts.join('&');
      }
      return request('/rooms' + qs);
    },

    checkAvailability: function (checkIn, checkOut, roomId) {
      var qs = '/rooms/availability?checkIn=' + encodeURIComponent(ymd(checkIn)) + '&checkOut=' + encodeURIComponent(ymd(checkOut));
      if (roomId) qs += '&roomId=' + encodeURIComponent(roomId);
      return request(qs);
    },

    createBooking: function (payload) {
      return request('/bookings', { method: 'POST', body: payload });
    },
  };

  // ====== booking.html wizard patch ======
  function patchBookingPage() {
    if (!document.getElementById('room-grid')) return;

    // 1. Enrich the wizard's hardcoded ROOMS with live server ids & prices.
    FAM.Booking.rooms({ limit: 50 }).then(function (data) {
      var live = data && data.rooms ? data.rooms : [];
      var bySlug = {};
      live.forEach(function (r) { bySlug[r.slug] = r; });
      if (typeof window.ROOMS === 'undefined') return;
      window.ROOMS.forEach(function (room) {
        var match = bySlug[room.id] || bySlug[(room.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')];
        if (match) {
          room._id = match._id;
          if (match.isAvailable === false || match.status === 'maintenance' || match.status === 'out_of_service') room._down = true;
          if (match.discountPrice || match.pricePerNight) room.price = match.discountPrice || match.pricePerNight;
        }
      });
      if (window.renderRooms) window.renderRooms();
      runAvailCheckLater();
    }).catch(function () { /* offline / backend unavailable — keep static prices */ });

    // 2. Availability check as soon as a room + both dates are chosen.
    updateDateDisplay(); // re-assign below
    var availNote = document.createElement('div');
    availNote.id = 'wizard-avail-note';
    availNote.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;font-size:13px;display:none;';
    var nightsDisplay = document.getElementById('nights-display');
    if (nightsDisplay && nightsDisplay.parentNode) {
      nightsDisplay.parentNode.appendChild(availNote);
    }

    var lastCheckKey = '';
    var wizardAvailOk = true;
    window.wizardAvailOk = true;

    function runAvailCheckLater() {
      if (!window.booking || !window.booking.checkIn || !window.booking.checkOut) return;
      lastCheckKey = '';
      runAvailCheck();
    }

    function setAvail(state, msg) {
      wizardAvailOk = state;
      window.wizardAvailOk = state;
      availNote.style.display = msg ? 'block' : 'none';
      availNote.textContent = msg || '';
      availNote.style.background = state ? 'rgba(31,122,69,0.08)' : 'rgba(186,26,26,0.09)';
      availNote.style.color = state ? '#1f7a45' : '#b91c1c';
    }

    function runAvailCheck() {
      if (!window.booking) return;
      var room = window.booking.room;
      var ci = window.booking.checkIn;
      var co = window.booking.checkOut;
      if (!room || !ci || !co) return;
      var key = (room._id || room.id) + '|' + ymd(ci) + '|' + ymd(co);
      if (key === lastCheckKey) return;
      lastCheckKey = key;
      if (room._down) {
        setAvail(false, 'This room is currently out of service. Please select another room.');
        return;
      }
      setAvail(true, 'Checking availability…');
      FAM.Booking.checkAvailability(ci, co, room._id).then(function (data) {
        var list = (data && data.availability) || [];
        var item = null;
        if (room._id) {
          list.some(function (it) { if (it && it.room && String(it.room._id) === String(room._id)) { item = it; return true; } return false; });
        }
        if (!item) {
          list.some(function (it) { if (it && it.room && (it.room.slug === room.id || it.room.slug === (room.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))) { item = it; return true; } return false; });
        }
        if (item && item.available === false) {
          setAvail(false, 'This room is not available for the selected dates. Please pick different dates or another room.');
        } else {
          setAvail(true, '✓ Available for your selected dates.');
        }
      }).catch(function () {
        setAvail(true, '');
      });
    }

    var origDateDisplay = window.updateDateDisplay;
    window.updateDateDisplay = function () {
      if (typeof origDateDisplay === 'function') origDateDisplay.apply(null, arguments);
      runAvailCheck();
    };

    var origCanGoNext = window.canGoNext;
    window.canGoNext = function () {
      var base = typeof origCanGoNext === 'function' ? origCanGoNext() : true;
      if (window.currentStep === 1) return base && wizardAvailOk;
      return base;
    };

    // 3. Real booking creation on "Pay ¥…" click.
    window.handlePayment = function () {
      var payBtn = document.getElementById('pay-btn');
      if (payBtn) { payBtn.textContent = 'Reserving…'; payBtn.disabled = true; }

      if (!FAM.Auth || !FAM.Auth.isAuthenticated || !FAM.Auth.isAuthenticated()) {
        if (payBtn) { payBtn.textContent = 'Pay Now'; payBtn.disabled = false; }
        window.alert('Please sign in to confirm your booking. You\'ll be redirected to log in — your selection is preserved.');
        window.location.href = '/pages/login.html?redirect=' + encodeURIComponent('/pages/booking.html');
        return;
      }

      var b = window.booking;
      var nights = window.getNights ? window.getNights() : 0;
      var payload = {
        room: b.room && b.room._id ? b.room._id : b.room.id,
        checkIn: ymd(b.checkIn),
        checkOut: ymd(b.checkOut),
        guests: { adults: b.adults, children: b.children },
        guestName: b.fullName || '',
        guestEmail: b.email || '',
        guestPhone: b.phone || '',
        specialRequests: b.specialRequests || '',
      };

      FAM.Booking.createBooking(payload).then(function (data) {
        var booking = data && data.booking ? data.booking : null;
        if (window.renderConfirmation) window.renderConfirmation();
        var conf = document.getElementById('confirmation-summary');
        if (conf && booking && booking._id) {
          conf.insertAdjacentHTML('beforeend',
            '<div class="flex items-center justify-between py-2"><span class="text-on-surface-variant/40 font-body text-[11px] tracking-[0.1em] uppercase">Booking ID</span>' +
            '<span class="text-primary font-body text-sm font-medium">FAM-' + String(booking._id).slice(-6).toUpperCase() + '</span></div>' +
            '<div class="flex items-center justify-between py-2"><span class="text-on-surface-variant/40 font-body text-[11px] tracking-[0.1em] uppercase">Payment</span>' +
            '<span class="text-primary font-body text-sm font-medium capitalize">Pay at property</span></div>');
        }
        if (window.goToStep) window.goToStep(6);
      }).catch(function (err) {
        if (payBtn) { payBtn.textContent = 'Pay Now'; payBtn.disabled = false; }
        var total = document.getElementById('payment-total');
        var base = total && total.parentNode ? total.parentNode : null;
        var box = document.createElement('div');
        box.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(186,26,26,0.09);color:#b91c1c;font-size:13px;';
        box.textContent = 'Unable to create your booking: ' + (err.message || 'please try again.');
        box.id = 'pay-error';
        if (base) {
          var old = base.parentNode && base.parentNode.querySelector('#pay-error');
          if (old) old.remove();
          base.insertAdjacentElement('afterend', box);
        }
      });
    };

    // 4. The inline wizard bound its original handler to the old button during
    // DOMContentLoaded. Replace the node (no listeners cloned) and re-bind.
    var oldBtn = document.getElementById('pay-btn');
    if (oldBtn && !oldBtn.dataset.wzReady) {
      var fresh = oldBtn.cloneNode(false);
      fresh.disabled = true;
      fresh.textContent = 'Pay Now';
      oldBtn.parentNode.replaceChild(fresh, oldBtn);
      fresh.dataset.wzReady = '1';
      fresh.addEventListener('click', window.handlePayment);
    }
  }

  function init() {
    if (document.body.dataset.bookingDataReady) return;
    document.body.dataset.bookingDataReady = '1';
    patchBookingPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();