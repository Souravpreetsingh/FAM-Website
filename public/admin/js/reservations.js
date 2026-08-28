(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;

  const state = {
    page: 1,
    limit: 25,
    status: '',
    search: '',
    source: '',
  };

  function buildQuery() {
    let q = '/bookings?page=' + state.page + '&limit=' + state.limit;
    if (state.status) q += '&status=' + state.status;
    if (state.search) q += '&search=' + encodeURIComponent(state.search);
    if (state.source) q += '&source=' + state.source;
    return q;
  }

  function actionsFor(b) {
    const actions = [];
    if (b.status === 'pending') actions.push(['confirm', 'Confirm']);
    if (b.status === 'confirmed') actions.push(['check-in', 'Check in']);
    if (b.status === 'confirmed' || b.status === 'checked_in') actions.push(['no-show', 'No show']);
    if (b.status === 'checked_in') actions.push(['check-out', 'Check out']);
    if (['pending', 'confirmed', 'checked_in', 'checked_out'].indexOf(b.status) !== -1) {
      actions.push(['move', 'Move room']);
    }
    if (['pending', 'confirmed', 'checked_in', 'checked_out'].indexOf(b.status) !== -1) {
      actions.push(['cancel', 'Cancel']);
    }
    return actions;
  }

  async function load() {
    const stage = document.getElementById('resView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    try {
      const data = await window.AdminAPI.get(buildQuery());
      render(stage, data);
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(err.message) + '</div>';
    }
  }

  function render(stage, data) {
    const rows = data.bookings || [];
    const pag = data.pagination || {};

    let tableRows = rows.map(function (b) {
      const who = b.guestName || (b.user ? (b.user.name || b.user.email) : 'Guest');
      const acts = actionsFor(b).map(function (a) {
        return '<button class="btn btn-xs" data-act="' + a[0] + '" data-id="' + b._id + '">' + a[1] + '</button>';
      }).join(' ');
      return '<tr>' +
        '<td><strong>' + U.esc(b.room ? b.room.name : '—') + '</strong>' +
        '<div class="sub">' + U.esc(b.source || 'ONLINE') + ' · ' + U.inr(b.totalAmount) + '</div></td>' +
        '<td>' + U.esc(who) + '<div class="sub">' + U.esc(b.guestEmail || '') + '</div></td>' +
        '<td>' + U.fmtDate(b.checkIn) + '<div class="sub">→ ' + U.fmtDate(b.checkOut) + '</div></td>' +
        '<td><span class="status-tag s-' + (b.status || 'pending') + '">' + U.statusLabel(b.status) + '</span>' +
        '<div class="sub">Pay: ' + U.esc(b.paymentStatus || 'pending') + '</div></td>' +
        '<td>' + (acts || '<span class="muted">—</span>') + '</td>' +
        '</tr>';
    }).join('');

    if (!rows.length) tableRows = '<tr><td colspan="5" class="muted">No reservations found.</td></tr>';

    stage.innerHTML =
      '<div class="card"><div class="card-head">' +
      '<h3>Reservations</h3>' +
      '<button class="btn btn-primary" id="offlineBtn">+ New offline booking</button>' +
      '</div>' +
      '<div class="filters">' +
      '<input class="input" id="fSearch" placeholder="Search guest name / email / phone" value="' + U.esc(state.search) + '" />' +
      '<select class="input" id="fStatus">' +
      '<option value="">All statuses</option>' +
      ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'completed'].map(function (s) {
        return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + U.statusLabel(s) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="input" id="fSource">' +
      '<option value="">All sources</option>' +
      ['ONLINE', 'OFFLINE', 'PHONE', 'WALK-IN', 'ADMIN'].map(function (s) {
        return '<option value="' + s + '"' + (state.source === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') +
      '</select>' +
      '<button class="btn btn-ghost" id="fApply">Apply</button>' +
      '</div>' +
      '<table class="table"><thead><tr><th>Room / price</th><th>Guest</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead>' +
      '<tbody>' + tableRows + '</tbody></table>' +
      '<div class="pager">' +
      (pag.page > 1 ? '<button class="btn btn-ghost" data-nav="-1">‹ Prev</button>' : '<span></span>') +
      '<span class="muted">Page ' + pag.page + ' of ' + (pag.totalPages || 1) + '</span>' +
      (pag.page < pag.totalPages ? '<button class="btn btn-ghost" data-nav="1">Next ›</button>' : '<span></span>') +
      '</div></div>';

    stage.querySelector('#offlineBtn').addEventListener('click', openOffline);
    stage.querySelector('#fApply').addEventListener('click', function () {
      state.search = stage.querySelector('#fSearch').value.trim();
      state.status = stage.querySelector('#fStatus').value;
      state.source = stage.querySelector('#fSource').value;
      state.page = 1;
      load();
    });
    stage.querySelector('#fSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') stage.querySelector('#fApply').click();
    });

    Array.prototype.forEach.call(stage.querySelectorAll('[data-nav]'), function (b) {
      b.addEventListener('click', function () {
        state.page += parseInt(b.dataset.nav, 10);
        load();
      });
    });

    Array.prototype.forEach.call(stage.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        handleAction(b.dataset.act, b.dataset.id, stage);
      });
    });
  }

  function handleAction(act, id, stage) {
    if (act === 'confirm' || act === 'check-in' || act === 'check-out' || act === 'no-show') {
      const pathMap = { confirm: '/bookings/' + id + '/confirm', 'check-in': '/bookings/' + id + '/check-in', 'check-out': '/bookings/' + id + '/check-out', 'no-show': '/bookings/' + id + '/no-show' };
      window.AdminAPI.put(pathMap[act]).then(function () {
        window.AdminUI.toast('Updated');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
    } else if (act === 'move') {
      openMoveModal(id, stage);
    } else if (act === 'cancel') {
      openCancelModal(id, stage);
    }
  }

  function openOffline() {
    let inner =
      '<h3>New offline booking</h3>' +
      '<label class="field"><span>Room *</span><select id="obRoom"></select></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>Check-in *</span><input type="date" id="obIn" /></label>' +
      '<label class="field"><span>Check-out *</span><input type="date" id="obOut" /></label></div>' +
      '<div class="field-row">' +
      '<label class="field"><span>Adults *</span><input type="number" id="obAdults" min="1" value="2" /></label>' +
      '<label class="field"><span>Children</span><input type="number" id="obChildren" min="0" value="0" /></label></div>' +
      '<label class="field"><span>Guest name *</span><input id="obName" /></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>Email</span><input type="email" id="obEmail" /></label>' +
      '<label class="field"><span>Phone</span><input id="obPhone" /></label></div>' +
      '<label class="field"><span>Source</span><select id="obSource">' +
      '<option value="WALK-IN">Walk-in</option><option value="PHONE">Phone</option>' +
      '<option value="OFFLINE">Offline</option><option value="ADMIN">Admin</option></select></label>' +
      '<label class="field"><span>Amount paid (₹)</span><input type="number" id="obPaid" min="0" value="0" /></label>' +
      '<label class="field"><span>Notes</span><textarea id="obNotes" rows="2"></textarea></label>' +
      '<button class="btn btn-primary btn-block" id="obSave">Create booking</button>';

    window.AdminUI.openModal(inner);

    const today = U.todayStr();
    document.getElementById('obIn').value = today;
    document.getElementById('obOut').value = today;

    loadRoomsInto(document.getElementById('obRoom'));

    document.getElementById('obSave').addEventListener('click', function () {
      const payload = {
        room: document.getElementById('obRoom').value,
        checkIn: document.getElementById('obIn').value,
        checkOut: document.getElementById('obOut').value,
        guests: {
          adults: parseInt(document.getElementById('obAdults').value, 10) || 1,
          children: parseInt(document.getElementById('obChildren').value, 10) || 0,
        },
        guestName: document.getElementById('obName').value.trim(),
        guestEmail: document.getElementById('obEmail').value.trim() || null,
        guestPhone: document.getElementById('obPhone').value.trim(),
        source: document.getElementById('obSource').value,
        notes: document.getElementById('obNotes').value.trim(),
        amountPaid: parseFloat(document.getElementById('obPaid').value) || 0,
      };
      window.AdminAPI.post('/bookings/offline', payload).then(function () {
        window.AdminUI.closeModal();
        window.AdminUI.toast('Offline booking created');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
    });
  }

  function openMoveModal(id) {
    window.AdminUI.openModal(
      '<h3>Move room</h3>' +
      '<label class="field"><span>New room</span><select id="mvRoom"></select></label>' +
      '<button class="btn btn-primary btn-block" id="mvSave">Move booking</button>'
    );
    loadRoomsInto(document.getElementById('mvRoom'));
    document.getElementById('mvSave').addEventListener('click', function () {
      window.AdminAPI.put('/bookings/' + id + '/move-room', { newRoom: document.getElementById('mvRoom').value }).then(function () {
        window.AdminUI.closeModal();
        window.AdminUI.toast('Room moved');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
    });
  }

  function openCancelModal(id) {
    window.AdminUI.openModal(
      '<h3>Cancel reservation</h3>' +
      '<label class="field"><span>Reason</span><input id="cxReason" maxlength="500" /></label>' +
      '<button class="btn btn-danger btn-block" id="cxSave">Cancel booking</button>'
    );
    document.getElementById('cxSave').addEventListener('click', function () {
      window.AdminAPI.post('/bookings/' + id + '/cancel', { reason: document.getElementById('cxReason').value }).then(function () {
        window.AdminUI.closeModal();
        window.AdminUI.toast('Booking cancelled');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
    });
  }

  function loadRoomsInto(select) {
    window.AdminAPI.get('/rooms?limit=100').then(function (data) {
      const rooms = data.rooms || [];
      select.innerHTML = rooms.map(function (r) {
        return '<option value="' + r._id + '">' + U.esc(r.name) + '</option>';
      }).join('');
    }).catch(function () {
      select.innerHTML = '<option value="">(no rooms)</option>';
    });
  }

  window.AdminViews.reservations = function (stage) {
    stage.id = 'resView';
    load();
  };
})();