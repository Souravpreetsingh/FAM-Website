(function () {
  'use strict';

  var FAM = window.FAM || {};
  window.FAM = FAM;

  function apiBase() {
    if (window.FAM_API_BASE) return window.FAM_API_BASE.replace(/\/auth$/, '');
    // Frontend is served by the same Express backend, so same-origin is the
    // default and needs no hard-coded host. An optional global FAM_ENV can point
    // a separately-hosted static build at an API (see api-base.js).
    if (window.FAM_ENV && window.FAM_ENV.API_BASE) return window.FAM_ENV.API_BASE.replace(/\/$/, '');
    return '/api/v1';
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

    // ── Login-return booking draft (non-sensitive state only) ──
    // Preserved across the sign-in hop so the customer resumes the SAME
    // booking + payment step instead of re-filling the wizard. sessionStorage
    // is tab-scoped and short-lived. No tokens, signatures or card data are
    // ever stored here.
    DRAFT_KEY: 'fam_booking_draft',

    saveDraft: function () {
      try {
        var b = window.booking;
        if (!b || !b.room) return;
        var draft = {
          roomId: b.room.id, // static ROOMS id (slug) — what restore() looks up
          checkIn: ymd(b.checkIn),
          checkOut: ymd(b.checkOut),
          adults: b.adults,
          children: b.children,
          fullName: b.fullName || '',
          email: b.email || '',
          phone: b.phone || '',
          specialRequests: b.specialRequests || '',
          paymentMethod: b.paymentMethod || null,
        };
        sessionStorage.setItem(FAM.Booking.DRAFT_KEY, JSON.stringify(draft));
      } catch (e) { /* storage unavailable — still redirect to login */ }
    },

    clearDraft: function () {
      try { sessionStorage.removeItem(FAM.Booking.DRAFT_KEY); } catch (e) { /* ignore */ }
    },

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

    myBookings: function (status) {
      var qs = status ? '?status=' + encodeURIComponent(status) : '';
      return request('/bookings/my' + qs);
    },

    createPaymentOrder: function (bookingId) {
      return request('/payments/create-order', { method: 'POST', body: { bookingId: bookingId } });
    },

    verifyPayment: function (payload) {
      return request('/payments/verify', { method: 'POST', body: payload });
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

    // 3. Real booking creation + Razorpay payment on "Pay Now" click.
    window.handlePayment = function () {
      // Re-entry guard: a single click/branch must not kick off a second
      // booking/reservation while one is in flight.
      if (window.__famPaymentInFlight) { return; }
      window.__famPaymentInFlight = true;
      var release = function () { window.__famPaymentInFlight = false; };

      var payBtn = document.getElementById('pay-btn');
      var payErr = function (msg) {
        if (payBtn) { payBtn.textContent = 'Pay Now'; payBtn.disabled = false; }
        var total = document.getElementById('payment-total');
        var base = total && total.parentNode ? total.parentNode : null;
        var old = base && base.parentNode ? base.parentNode.querySelector('#pay-error') : null;
        if (old) old.remove();
        if (!msg || !base) return;
        var box = document.createElement('div');
        box.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(186,26,26,0.09);color:#b91c1c;font-size:13px;';
        box.textContent = msg;
        box.id = 'pay-error';
        base.insertAdjacentElement('afterend', box);
      };
      if (payBtn) { payBtn.textContent = 'Reserving…'; payBtn.disabled = true; }

      if (!FAM.Auth || !FAM.Auth.isAuthenticated || !FAM.Auth.isAuthenticated()) {
        release();
        // Preserve the in-progress booking so the customer resumes exactly where
        // they left off after signing in instead of re-filling the wizard.
        FAM.Booking.saveDraft();
        payErr('Please sign in to confirm your booking.');
        window.location.href = '/pages/login.html?redirect=' + encodeURIComponent('/pages/booking.html?return=1');
        return;
      }

      var b = window.booking;
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

      var createdBooking = null;

      function startOrder(booking) {
        createdBooking = booking;
        if (payBtn) { payBtn.textContent = 'Preparing payment…'; }
        return FAM.Booking.createPaymentOrder(booking._id).then(function (order) {
          return openRazorpayCheckout(order, booking, b);
        });
      }

      // Reuse an existing pending reservation for the same room & dates so a
      // dismissed/failed checkout doesn't double-book.
      var datesMatch = function (bk) {
        var r = bk.room || {};
        var roomMatch = false;
        if (r._id && b.room && b.room._id) roomMatch = String(r._id) === String(b.room._id);
        if (!roomMatch && r.slug && b.room) roomMatch = r.slug === b.room.id;
        return roomMatch &&
          ymd(new Date(bk.checkIn)) === ymd(b.checkIn) &&
          ymd(new Date(bk.checkOut)) === ymd(b.checkOut);
      };

      FAM.Booking.myBookings('pending').then(function (data) {
        var list = (data && data.results) || [];
        var reuse = null;
        list.some(function (bk) { if (datesMatch(bk)) { reuse = bk; return true; } return false; });
        if (reuse && reuse._id) {
          return startOrder(reuse);
        }
        return FAM.Booking.createBooking(payload).then(function (data2) {
          var booking = data2 && data2.booking ? data2.booking : null;
          if (!booking || !booking._id) { payErr('Booking could not be created.'); return; }
          return startOrder(booking);
        });
      }).catch(function (err) {
        release();
        if (createdBooking) {
          // Booking exists but payment couldn't start — keep the reservation,
          // show confirmation as pending rather than a dead-end error.
          showConfirmation(createdBooking, false, err.message || null);
        } else {
          payErr('Unable to complete your booking: ' + (err.message || 'please try again.'));
        }
      });
    };

    // ── Razorpay checkout ──
    function loadRazorpayScript() {
      return new Promise(function (resolve, reject) {
        if (window.Razorpay) { resolve(window.Razorpay); return; }
        var s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = function () { resolve(window.Razorpay); };
        s.onerror = function () { reject(new Error('Could not load payment gateway.')); };
        document.head.appendChild(s);
      });
    }

    function openRazorpayCheckout(order, booking, b) {
      var orderId = order.razorpayOrderId || order.orderId;
      var keyId = order.keyId || (order.notes && order.notes.key);
      if (!orderId || !keyId) {
        var boxPay = document.getElementById('pay-error');
        var base = document.getElementById('payment-total') ? document.getElementById('payment-total').parentNode : null;
        var o2 = base ? base.parentNode.querySelector('#pay-error') : null;
        if (o2) o2.textContent = 'Payment gateway is not configured yet.';
        else {
          var nb = document.createElement('div');
          nb.id = 'pay-error';
          nb.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(186,26,26,0.09);color:#b91c1c;font-size:13px;';
          nb.textContent = 'Payment is temporarily unavailable. Your booking is reserved — please contact us to complete payment.';
          if (base) base.insertAdjacentElement('afterend', nb);
        }
        showConfirmation(booking, false);
        return;
      }

      return loadRazorpayScript().then(function (Razorpay) {
        var options = {
          key: keyId,
          amount: Number(order.amount !== undefined ? order.amount : (booking.totalAmount * 100)),
          currency: order.currency || booking.currency || 'INR',
          name: 'Flamingo aur Maina',
          description: 'Booking ' + booking._id,
          order_id: orderId,
          prefill: {
            name: b.fullName || '',
            email: b.email || '',
            contact: b.phone || '',
          },
          theme: { color: '#0a341d' },
          handler: function (response) {
            return FAM.Booking.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }).then(function () {
              window.__famPaymentInFlight = false;
              var pc = document.getElementById('pay-btn');
              if (pc) { pc.textContent = 'Pay Now'; pc.disabled = false; }
              showConfirmation(booking, true);
            }).catch(function (err) {
              window.__famPaymentInFlight = false;
              var pc2 = document.getElementById('pay-btn');
              if (pc2) { pc2.textContent = 'Pay Now'; pc2.disabled = false; }
              var total = document.getElementById('payment-total');
              var base = total && total.parentNode ? total.parentNode : null;
              var old = base && base.parentNode ? base.parentNode.querySelector('#pay-error') : null;
              if (old) old.remove();
              var box = document.createElement('div');
              box.id = 'pay-error';
              box.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(186,26,26,0.09);color:#b91c1c;font-size:13px;';
              box.textContent = 'Payment was not confirmed: ' + (err.message || 'please try again.');
              if (base) base.insertAdjacentElement('afterend', box);
            });
          },
          modal: {
            ondismiss: function () {
              window.__famPaymentInFlight = false;
              var pc3 = document.getElementById('pay-btn');
              if (pc3) { pc3.textContent = 'Pay Now'; pc3.disabled = false; }
            },
          },
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          window.__famPaymentInFlight = false;
          var pc4 = document.getElementById('pay-btn');
          if (pc4) { pc4.textContent = 'Pay Now'; pc4.disabled = false; }
          var total = document.getElementById('payment-total');
          var base = total && total.parentNode ? total.parentNode : null;
          var old = base && base.parentNode ? base.parentNode.querySelector('#pay-error') : null;
          if (old) old.remove();
          var fb = document.createElement('div');
          fb.id = 'pay-error';
          fb.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(186,26,26,0.09);color:#b91c1c;font-size:13px;';
          fb.textContent = 'Payment failed: ' + ((resp && resp.error && resp.error.description) || 'please try again.');
          if (base) base.insertAdjacentElement('afterend', fb);
        });
        rzp.open();
      }).catch(function (err) {
        window.__famPaymentInFlight = false;
        showConfirmation(booking, false);
        var pb = document.getElementById('pay-btn');
        if (pb) { pb.textContent = 'Pay Now'; pb.disabled = false; }
        var total = document.getElementById('payment-total');
        var base = total && total.parentNode ? total.parentNode : null;
        var old = base && base.parentNode ? base.parentNode.querySelector('#pay-error') : null;
        if (old) old.remove();
        var eb = document.createElement('div');
        eb.id = 'pay-error';
        eb.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:12px;background:rgba(186,26,26,0.09);color:#b91c1c;font-size:13px;';
        eb.textContent = 'Unable to start payment: ' + (err.message || 'please try again.');
        if (base) base.insertAdjacentElement('afterend', eb);
      });
    }

    function showConfirmation(booking, paid, note) {
      FAM.Booking.clearDraft();
      if (window.booking) window.booking.paymentMethod = paid ? 'Paid online' : 'Pending';
      if (window.renderConfirmation) window.renderConfirmation();
      var conf = document.getElementById('confirmation-summary');
      if (conf && booking && booking._id) {
        conf.insertAdjacentHTML('beforeend',
          '<div class="flex items-center justify-between py-2"><span class="text-on-surface-variant/40 font-body text-[11px] tracking-[0.1em] uppercase">Booking ID</span>' +
          '<span class="text-primary font-body text-sm font-medium">FAM-' + String(booking._id).slice(-6).toUpperCase() + '</span></div>');
        if (note) {
          conf.insertAdjacentHTML('beforeend',
            '<div class="mt-2 rounded-xl bg-accent-gold/10 border border-accent-gold/20 px-3 py-2 font-body text-[12px] text-on-surface-variant/70">' + note + '</div>');
        }
      }
      var pb = document.getElementById('pay-btn');
      if (pb) { pb.textContent = 'Pay Now'; pb.disabled = false; }
      if (window.goToStep) window.goToStep(6);
    }

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