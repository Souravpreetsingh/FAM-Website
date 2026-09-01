(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;
  let page = 1;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const STATUS_CLS = {
    available: 'm-available',
    booked: 'm-booked',
    reserved: 'm-reserved',
    maintenance: 'm-maintenance',
    blocked: 'm-blocked',
  };

  function daysInMonth(m, y) {
    return new Date(y, m + 1, 0).getDate();
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function keyDate(m, y, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayStr() { return U.todayStr(); }

  async function load() {
    const stage = document.getElementById('roomsView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    try {
      const data = await window.AdminAPI.get('/rooms?page=' + page + '&limit=50');
      render(stage, data);
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(err.message) + '</div>';
    }
  }

  function roomBadge(room) {
    let cls = 's-available';
    let txt = room.status || 'available';
    if (room.currentlyOccupied) { cls = 's-checked_in'; txt = 'Occupied'; }
    else if (room.status === 'maintenance' || room.status === 'out_of_service') { cls = 's-cancelled'; txt = room.status || 'maintenance'; }
    else if (room.blockedToday) { cls = 's-pending'; txt = 'Blocked'; }
    return '<span class="status-tag ' + cls + '">' + U.esc(txt) + '</span>';
  }

  function render(stage, data) {
    const rooms = data.rooms || [];
    const pag = data.pagination || {};

    let cards = rooms.map(function (r) {
      const today = todayStr();
      const tomorrow = U.fmtDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      return '<div class="room-card" data-room-id="' + r._id + '">' +
        '<div class="room-card-head"><strong>' + U.esc(r.name) + '</strong>' + roomBadge(r) + '</div>' +
        '<div class="room-card-meta">' + U.inr(r.discountPrice || r.pricePerNight) + '/night · ' +
        (r.capacity ? r.capacity.maxGuests : 0) + ' guests · ' + U.esc(r.type || 'Standard') + '</div>' +
        '<div class="room-cal" data-cal="' + r._id + '">' +
        '<div class="room-cal-head">' +
        '<button class="btn btn-xs" data-cal-prev="1" type="button">‹</button>' +
        '<span class="room-cal-title" data-cal-title>—</span>' +
        '<button class="btn btn-xs" data-cal-next="1" type="button">›</button>' +
        '</div>' +
        '<div class="room-cal-legend">' +
        '<span class="m-dot m-available"></span>Avail<span class="m-dot m-booked"></span>Booked' +
        '<span class="m-dot m-maintenance"></span>Maint<span class="m-dot m-blocked"></span>Blocked' +
        '</div>' +
        '<div class="room-cal-grid" data-cal-grid></div>' +
        '</div>' +
        '<div class="room-card-avail">' +
        '<div class="avail-row">' +
        '<label class="avail-label">From<input type="date" class="avail-from" value="' + today + '" /></label>' +
        '<span class="avail-arrow">→</span>' +
        '<label class="avail-label">To<input type="date" class="avail-to" value="' + tomorrow + '" /></label>' +
        '</div>' +
        '<div class="avail-actions">' +
        '<button class="btn btn-xs btn-primary" data-unavail="1">Mark unavailable</button>' +
        '<button class="btn btn-xs" data-avail="1">Mark available</button>' +
        '</div></div>' +
        '<div class="room-card-actions">' +
        '<button class="btn btn-xs" data-m="1" data-id="' + r._id + '">Maintenance…</button>' +
        '<button class="btn btn-xs" data-clear="1" data-id="' + r._id + '">Make available</button>' +
        '</div></div>';
    }).join('');

    if (!rooms.length) cards = '<p class="muted">No rooms found.</p>';

    stage.innerHTML =
      '<div class="card"><div class="card-head"><h3>Rooms</h3></div>' +
      '<div class="room-grid">' + cards + '</div>' +
      '<div class="pager">' +
      (pag.page > 1 ? '<button class="btn btn-ghost" id="prevPage">‹ Prev</button>' : '<span></span>') +
      '<span class="muted">Page ' + pag.page + ' of ' + (pag.totalPages || 1) + '</span>' +
      (pag.page < pag.totalPages ? '<button class="btn btn-ghost" id="nextPage">Next ›</button>' : '<span></span>') +
      '</div></div>';

    const pop = stage.querySelector('#nextPage');
    if (pop) pop.addEventListener('click', function () { page++; load(); });
    const pr = stage.querySelector('#prevPage');
    if (pr) pr.addEventListener('click', function () { page = Math.max(1, page - 1); load(); });

    Array.prototype.forEach.call(stage.querySelectorAll('[data-m]'), function (b) {
      b.addEventListener('click', function () { openMaintenance(b.dataset.id); });
    });
    Array.prototype.forEach.call(stage.querySelectorAll('[data-clear]'), function (b) {
      b.addEventListener('click', function () { makeAvailable(b.dataset.id); });
    });
    Array.prototype.forEach.call(stage.querySelectorAll('[data-unavail]'), function (b) {
      b.addEventListener('click', function () { markRange(b.closest('.room-card'), false); });
    });
    Array.prototype.forEach.call(stage.querySelectorAll('[data-avail]'), function (b) {
      b.addEventListener('click', function () { markRange(b.closest('.room-card'), true); });
    });

    // Per-room calendar initialisation
    rooms.forEach(function (r) {
      const cal = stage.querySelector('.room-cal[data-cal="' + r._id + '"]');
      if (cal) initCal(cal, r._id);
    });
  }

  // ── Per-room mini calendar ──
  function initCal(cal, roomId) {
    let curM = new Date().getMonth();
    let curY = new Date().getFullYear();
    const title = cal.querySelector('[data-cal-title]');
    const grid = cal.querySelector('[data-cal-grid]');

    function loadMonth() {
      title.textContent = MONTHS[curM] + ' ' + curY;
      grid.innerHTML = '<div class="room-cal-loading">Loading…</div>';
      window.AdminAPI.get('/availability/calendar?month=' + curM + '&year=' + curY).then(function (data) {
        const row = (data.calendar || []).find(function (x) { return String(x.room._id) === String(roomId); });
        const days = (row && row.days) || [];
        renderGrid(days);
      }).catch(function (e) {
        grid.innerHTML = '<div class="room-cal-loading">' + U.esc(e.message) + '</div>';
      });
    }

    function renderGrid(days) {
      const byDate = {};
      (days || []).forEach(function (d) { byDate[d.date] = d; });
      const dim = daysInMonth(curM, curY);
      const firstDow = new Date(Date.UTC(curY, curM, 1)).getUTCDay();
      const today = todayStr();
      let html = '<div class="m-dow">S</div><div class="m-dow">M</div><div class="m-dow">T</div>' +
        '<div class="m-dow">W</div><div class="m-dow">T</div><div class="m-dow">F</div><div class="m-dow">S</div>';
      for (let i = 0; i < firstDow; i++) html += '<div class="m-blank"></div>';
      for (let d = 1; d <= dim; d++) {
        const date = keyDate(curM, curY, d);
        const day = byDate[date];
        const status = day ? day.status : 'available';
        let extra = '';
        if (date === today) extra += ' m-today';
        let cls = STATUS_CLS[status] || 'm-available';
        // Clickable when the day can actually change state: an available night
        // (tap to block it) or a night holding a removable manual block
        // (BLOCKED/MAINTENANCE/RESERVED). Booked days are never clickable here —
        // bookings are managed in Reservations, and removing them is not allowed.
        const removable = day && day.blockId && String(day.blockKind || '').toUpperCase() !== 'BOOKED';
        const clickable = (day && day.status === 'available') || removable;
        const mclick = clickable ? ' m-click' : '';
        const title = (day ? (day.status + (day.guest ? ' · ' + day.guest : '')) : 'available') + ' ' + date;
        html += '<div class="m-cell ' + cls + extra + mclick + '" data-date="' + date + '" data-blockid="' + (day ? (day.blockId || '') : '') + '" data-status="' + (day ? day.status : '') + '" title="' + U.esc(title) + '">' + d + '</div>';
      }
      grid.innerHTML = html;

      Array.prototype.forEach.call(grid.querySelectorAll('.m-cell.m-click'), function (cell) {
        cell.addEventListener('click', function (e) { e.stopPropagation(); onCellClick(cell); });
      });
    }

    function onCellClick(cell) {
      if (cal.dataset.busy === '1') return;
      cal.dataset.busy = '1';
      const finish = function () { cal.dataset.busy = '0'; };
      const date = cell.dataset.date;
      const blockId = cell.dataset.blockid;
      if (blockId) {
        // remove this manual block night
        if (!window.confirm('Remove the block on ' + date + ' (make it available)?')) { finish(); return; }
        window.AdminAPI.del('/availability/block/' + blockId).then(function () {
          window.AdminUI.toast('Block removed — ' + date);
          finish();
          loadMonth();
        }).catch(function (e) { window.AdminUI.toast(e.message, true); finish(); });
      } else {
        // mark this single night unavailable: endDate = next day after `date`
        const dt = new Date(date + 'T00:00:00Z');
        dt.setUTCDate(dt.getUTCDate() + 1);
        const next = dt.toISOString().split('T')[0];
        window.AdminAPI.post('/availability/block', {
          roomId: roomId,
          startDate: date,
          endDate: next,
          reason: 'Manually blocked',
          kind: 'BLOCKED',
        }).then(function () {
          window.AdminUI.toast('Marked unavailable — ' + date);
          finish();
          loadMonth();
        }).catch(function (e) { window.AdminUI.toast(e.message, true); finish(); });
      }
    }

    cal.querySelector('[data-cal-prev]').addEventListener('click', function () {
      curM--; if (curM < 0) { curM = 11; curY--; } loadMonth();
    });
    cal.querySelector('[data-cal-next]').addEventListener('click', function () {
      curM++; if (curM > 11) { curM = 0; curY++; } loadMonth();
    });

    loadMonth();
  }

  function localDateStr(v) {
    return (v || '').slice(0, 10);
  }

  function markRange(card, makeAvailableFlag) {
    if (card.dataset.busy === '1') return;
    const id = card.getAttribute('data-room-id');
    const from = localDateStr(card.querySelector('.avail-from').value);
    const to = localDateStr(card.querySelector('.avail-to').value);
    if (!from || !to) { window.AdminUI.toast('Please choose both dates', true); return; }
    if (makeAvailableFlag && !window.confirm('Clear any manual/maintenance blocks for this room in ' + from + ' → ' + to + '?')) return;
    card.dataset.busy = '1';
    if (makeAvailableFlag) {
      window.AdminAPI.post('/availability/clear', {
        roomId: id,
        startDate: from,
        endDate: to,
      }).then(function () {
        window.AdminUI.toast('Room marked available for selected dates');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); card.dataset.busy = '0'; });
    } else {
      window.AdminAPI.post('/availability/block', {
        roomId: id,
        startDate: from,
        endDate: to,
        reason: 'Manually marked unavailable',
        kind: 'BLOCKED',
      }).then(function () {
        window.AdminUI.toast('Room marked unavailable for selected dates');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); card.dataset.busy = '0'; });
    }
  }

  function openMaintenance(id) {
    const today = U.todayStr();
    window.AdminUI.openModal(
      '<h3>Block for maintenance</h3>' +
      '<label class="field"><span>Start</span><input type="date" id="mtIn" value="' + today + '" /></label>' +
      '<label class="field"><span>End (check-out)</span><input type="date" id="mtOut" value="' + today + '" /></label>' +
      '<label class="field"><span>Reason</span><input id="mtReason" maxlength="500" value="Scheduled maintenance" /></label>' +
      '<button class="btn btn-primary btn-block" id="mtSave">Block room</button>'
    );
    const saveBtn = document.getElementById('mtSave');
    saveBtn.addEventListener('click', function () {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      window.AdminAPI.post('/availability/block', {
        roomId: id,
        startDate: document.getElementById('mtIn').value,
        endDate: document.getElementById('mtOut').value,
        reason: document.getElementById('mtReason').value,
        kind: 'MAINTENANCE',
      }).then(function () {
        window.AdminUI.closeModal();
        window.AdminUI.toast('Room blocked for maintenance');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); saveBtn.disabled = false; });
    });
  }

  function clearMaintenanceBlocksForRoom(id) {
    const d = new Date();
    const m0 = { m: d.getMonth(), y: d.getFullYear() };
    const m1 = { m: d.getMonth() === 11 ? 0 : d.getMonth() + 1, y: d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear() };
    const blocks = [];
    return Promise.all([m0, m1].map(function (mm) {
      return window.AdminAPI.get('/availability/calendar?month=' + mm.m + '&year=' + mm.y).then(function (data) {
        (data.calendar || []).forEach(function (row) {
          if (String(row.room._id) !== String(id)) return;
          (row.days || []).forEach(function (day) {
            if (day.blockId && String(day.blockKind || '').toUpperCase() === 'MAINTENANCE' && blocks.indexOf(day.blockId) === -1) blocks.push(day.blockId);
          });
        });
      }).catch(function () {});
    })).then(function () {
      return Promise.all(blocks.map(function (bid) {
        return window.AdminAPI.del('/availability/block/' + bid).catch(function () {});
      }));
    });
  }

  function makeAvailable(id) {
    if (!window.confirm('Mark this room available and clear maintenance blocks?')) return;
    window.AdminAPI.put('/rooms/' + id + '/status', { status: 'available', isAvailable: true })
      .then(function () { return clearMaintenanceBlocksForRoom(id); })
      .then(function () {
        window.AdminUI.toast('Room made available');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
  }

  window.AdminViews.rooms = function (stage) {
    stage.id = 'roomsView';
    load();
  };
})();