(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;

  let cur = { m: new Date().getMonth(), y: new Date().getFullYear() };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const STATUS_META = {
    available: { label: 'Available', cls: 'c-available' },
    booked: { label: 'Booked', cls: 'c-booked' },
    reserved: { label: 'Reserved', cls: 'c-reserved' },
    maintenance: { label: 'Maintenance', cls: 'c-maintenance' },
    blocked: { label: 'Blocked', cls: 'c-blocked' },
  };

  function daysInMonth(m, y) {
    return new Date(y, m + 1, 0).getDate();
  }

  function dayKey(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  async function load() {
    const stage = document.getElementById('avView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    try {
      const data = await window.AdminAPI.get('/availability/calendar?month=' + cur.m + '&year=' + cur.y);
      console.log('Calendar payload:', data);
      render(stage, data);
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(err.message) + '</div>';
    }
  }

  function render(stage, data) {
    const rows = data.calendar || [];
    const dim = daysInMonth(cur.m, cur.y);
    let headers = '<div class="cell head-corner">Room</div>';
    for (let d = 1; d <= dim; d++) {
      headers += '<div class="cell head-day">' + d + '</div>';
    }

    const body = rows.map(function (r) {
      let cells = '<div class="cell room-cell"><strong>' + U.esc(r.room.name) + '</strong>' +
        '<span class="room-meta">' + r.availableNights + '/' + (r.availableNights + r.occupiedNights) + ' free · ' +
        U.inr(r.pricePerNight) + '/night</span></div>';
      r.days.forEach(function (day) {
        const meta = STATUS_META[day.status] || { label: day.status, cls: 'c-available' };
        const title = U.fmtDate(day.date) + ' · ' + meta.label +
          (day.guest ? ' · ' + day.guest : '') +
          (day.note ? ' · ' + day.note : '');
        cells += '<div class="cell ' + meta.cls + '" data-room="' + r.room._id + '" data-roomname="' + U.esc(r.room.name) + '" data-date="' + day.date + '" data-blockid="' + (day.blockId || '') + '" data-status="' + day.status + '" title="' + U.esc(title) + '"></div>';
      });
      return '<div class="cal-row">' + cells + '</div>';
    }).join('');

    stage.innerHTML =
      '<div class="card"><div class="card-head">' +
      '<button class="btn btn-ghost" id="calPrev">‹</button>' +
      '<h3>' + MONTHS[cur.m] + ' ' + cur.y + '</h3>' +
      '<button class="btn btn-ghost" id="calNext">›</button>' +
      '<button class="btn btn-primary" id="rangeBlockBtn">Block range</button>' +
      '</div>' +
      '<div class="legend">' +
      Object.keys(STATUS_META).map(function (k) {
        return '<span class="legend-item"><span class="dot ' + STATUS_META[k].cls + '"></span>' + STATUS_META[k].label + '</span>';
      }).join('') +
      '</div>' +
      '<div class="cal-grid" style="grid-template-columns:150px repeat(' + dim + ', minmax(22px,1fr))">' + headers + body + '</div></div>';

    stage.querySelector('#calPrev').addEventListener('click', function () {
      cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; }
      load();
    });
    stage.querySelector('#calNext').addEventListener('click', function () {
      cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; }
      load();
    });
    stage.querySelector('#rangeBlockBtn').addEventListener('click', function () {
      openRangeBlock();
    });

    Array.prototype.forEach.call(stage.querySelectorAll('.cell[data-date]'), function (cell) {
      cell.addEventListener('click', function () {
        openDayModal(cell);
      });
    });
  }

  function openDayModal(cell) {
    const roomName = cell.dataset.roomname;
    const date = cell.dataset.date;
    const blockId = cell.dataset.blockid;
    const status = cell.dataset.status;

    let inner =
      '<h3>' + U.esc(roomName) + '</h3>' +
      '<p class="muted">' + U.fmtDate(date) + ' · currently ' + (STATUS_META[status] ? STATUS_META[status].label : status) + '</p>' +
      (blockId
        ? '<div class="modal-row"><button class="btn btn-danger" id="delBlockBtn">Mark available (remove block)</button></div>'
        : '<label class="field"><span>Kind</span><select id="blkKind"><option value="BLOCKED">Blocked</option><option value="RESERVED">Reserved (hold)</option><option value="MAINTENANCE">Maintenance</option></select></label>' +
          '<label class="field"><span>Reason</span><input id="blkReason" maxlength="500" placeholder="Optional" /></label>' +
          '<button class="btn btn-primary btn-block" id="saveBlockBtn">Apply</button>');

    window.AdminUI.openModal(inner);

    if (blockId) {
      document.getElementById('delBlockBtn').addEventListener('click', function () {
        window.AdminAPI.del('/availability/block/' + blockId).then(function () {
          window.AdminUI.closeModal();
          window.AdminUI.toast('Marked available');
          load();
        }).catch(function (e) { window.AdminUI.toast(e.message, true); });
      });
    } else {
      document.getElementById('saveBlockBtn').addEventListener('click', function () {
        window.AdminAPI.post('/availability/block', {
          roomId: cell.dataset.room,
          startDate: date,
          endDate: date,
          reason: document.getElementById('blkReason').value,
          kind: document.getElementById('blkKind').value,
        }).then(function () {
          window.AdminUI.closeModal();
          window.AdminUI.toast('Block created');
          load();
        }).catch(function (e) { window.AdminUI.toast(e.message, true); });
      });
    }
  }

  function openRangeBlock() {
    const inner =
      '<h3>Set availability for date range</h3>' +
      '<label class="field"><span>Room</span><select id="rbRoom"></select></label>' +
      '<label class="field"><span>Start</span><input type="date" id="rbStart" /></label>' +
      '<label class="field"><span>End (check-out)</span><input type="date" id="rbEnd" /></label>' +
      '<label class="field"><span>Status</span><select id="rbKind"><option value="BLOCKED">Unavailable (blocked)</option><option value="AVAILABLE">Available</option><option value="RESERVED">Reserved (hold)</option><option value="MAINTENANCE">Maintenance</option></select></label>' +
      '<label class="field"><span>Reason</span><input id="rbReason" maxlength="500" /></label>' +
      '<button class="btn btn-primary btn-block" id="rbSave">Apply</button>';

    window.AdminUI.openModal(inner);

    const today = U.todayStr();
    document.getElementById('rbStart').value = today;
    document.getElementById('rbEnd').value = today;

    window.AdminAPI.get('/rooms?limit=100').then(function (data) {
      const rooms = data.rooms || [];
      document.getElementById('rbRoom').innerHTML = rooms.map(function (r) {
        return '<option value="' + r._id + '">' + U.esc(r.name) + '</option>';
      }).join('');
    }).catch(function () {
      document.getElementById('rbRoom').innerHTML = '<option value="">(fallback: pick room id)</option>';
    });

    document.getElementById('rbSave').addEventListener('click', function () {
      const kind = document.getElementById('rbKind').value;
      const roomId = document.getElementById('rbRoom').value;
      const startDate = document.getElementById('rbStart').value;
      const endDate = document.getElementById('rbEnd').value;
      const apply = kind === 'AVAILABLE'
        ? window.AdminAPI.post('/availability/clear', { roomId: roomId, startDate: startDate, endDate: endDate })
        : window.AdminAPI.post('/availability/block', {
            roomId: roomId,
            startDate: startDate,
            endDate: endDate,
            reason: document.getElementById('rbReason').value,
            kind: kind,
          });
      apply.then(function () {
        window.AdminUI.closeModal();
        window.AdminUI.toast((kind === 'AVAILABLE' ? 'Marked available' : 'Blocked') + ' for selected dates');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
    });
  }

  window.AdminViews.availability = function (stage) {
    stage.id = 'avView';
    load();
  };
})();