(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;
  let page = 1;

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
      return '<div class="room-card">' +
        '<div class="room-card-head"><strong>' + U.esc(r.name) + '</strong>' + roomBadge(r) + '</div>' +
        '<div class="room-card-meta">' + U.inr(r.discountPrice || r.pricePerNight) + '/night · ' +
        (r.capacity ? r.capacity.maxGuests : 0) + ' guests · ' + U.esc(r.type || 'Standard') + '</div>' +
        '<div class="room-card-actions">' +
        '<button class="btn btn-xs" data-m="1" data-id="' + r._id + '">Maintenance</button>' +
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
    document.getElementById('mtSave').addEventListener('click', function () {
      window.AdminAPI.post('/rooms/' + id + '/maintenance', {
        startDate: document.getElementById('mtIn').value,
        endDate: document.getElementById('mtOut').value,
        reason: document.getElementById('mtReason').value,
      }).then(function () {
        window.AdminUI.closeModal();
        window.AdminUI.toast('Room blocked for maintenance');
        load();
      }).catch(function (e) { window.AdminUI.toast(e.message, true); });
    });
  }

  function makeAvailable(id) {
    if (!window.confirm('Mark this room available and clear maintenance blocks?')) return;
    window.AdminAPI.put('/rooms/' + id + '/status', { status: 'available', isAvailable: true }).then(function () {
      window.AdminUI.toast('Room made available');
      load();
    }).catch(function (e) { window.AdminUI.toast(e.message, true); });
  }

  window.AdminViews.rooms = function (stage) {
    stage.id = 'roomsView';
    load();
  };
})();