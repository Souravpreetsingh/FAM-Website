(function () {
  window.AdminViews = window.AdminViews || {};

  function statCards(s) {
    const cards = [
      { label: 'Total bookings', value: s.totalBookings },
      { label: 'Active stays', value: s.activeBookings },
      { label: 'Pending', value: s.pendingBookings },
      { label: 'Checked in', value: s.checkedIn },
      { label: 'Rooms', value: s.totalRooms },
      { label: 'Users', value: s.totalUsers },
      { label: 'Total revenue', value: window.AdminUI.inr(s.totalRevenue) },
      { label: 'Unread messages', value: s.unreadMessages },
    ];
    return cards.map(function (c) {
      return '<div class="stat-card"><div class="stat-value">' + c.value + '</div><div class="stat-label">' + c.label + '</div></div>';
    }).join('');
  }

  function availabilityPill(r) {
    let cls = 'avail-free';
    let txt = 'Available';
    if (r.currentGuest) { cls = 'avail-booked'; txt = 'Booked'; }
    else if (r.status === 'maintenance' || r.status === 'out_of_service') { cls = 'avail-maintenance'; txt = 'Maintenance'; }
    else if (r.blockedToday) { cls = 'avail-blocked'; txt = r.blockKind === 'reserved' ? 'Reserved' : 'Blocked'; }
    return '<span class="avail-pill ' + cls + '">' + txt + '</span>';
  }

  function roomStatusLabel(r) {
    if (r.currentGuest) return 'Booked';
    if (r.status === 'maintenance' || r.status === 'out_of_service') return 'Maintenance';
    if (r.blockedToday) return r.blockKind === 'reserved' ? 'Reserved' : 'Blocked';
    return 'Available';
  }

  window.AdminViews.dashboard = function (stage) {
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    window.AdminAPI.get('/dashboard').then(function (data) {
      if (!data) { stage.innerHTML = '<p>No data.</p>'; return; }
      const avail = data.availability || {};
      const snap = avail.rooms || [];
      const recents = data.recentBookings || [];
      const maxRev = (data.revenueByMonth || []).reduce(function (m, r) { return Math.max(m, r.revenue || 0); }, 0) || 1;

      var counts = { Available: 0, Booked: 0, Reserved: 0, Maintenance: 0, Blocked: 0 };
      snap.forEach(function (r) { var k = roomStatusLabel(r); if (counts[k] !== undefined) counts[k]++; });

      var roomStatusRows = snap.map(function (r) {
        var label = roomStatusLabel(r);
        var cls = label === 'Available' ? 'c-available' : label === 'Booked' ? 'c-booked' : label === 'Reserved' ? 'c-reserved' : label === 'Maintenance' ? 'c-maintenance' : 'c-blocked';
        return '<tr><td><strong>' + window.AdminUI.esc(r.name) + '</strong></td>' +
          '<td><span class="dot ' + cls + '" style="display:inline-block;width:10px;height:10px;border-radius:50;margin-right:6px;vertical-align:middle"></span>' + label + '</td>' +
          '<td>' + (r.currentGuest ? window.AdminUI.esc(r.currentGuest) : '—') + '</td></tr>';
      }).join('');

      var countBar = Object.keys(counts).map(function (k) {
        return '<span class="chip">' + k + ': ' + counts[k] + '</span>';
      }).join('');

      stage.innerHTML =
        '<div class="stats-grid">' + statCards(data.stats) + '</div>' +

        '<div class="card"><div class="card-head"><h3>Today\'s Rooms</h3></div>' +
        '<div class="today-chips">' + countBar + '</div>' +
        '<table class="table"><thead><tr><th>Room</th><th>Status</th><th>Guest</th></tr></thead><tbody>' +
        roomStatusRows +
        '</tbody></table></div>' +

        '<div class="card"><div class="card-head"><h3>Today ' +
        window.AdminUI.esc(avail.today || '') + '</h3>' +
        '<div class="today-chips">' +
        '<span class="chip">Arrivals: ' + (avail.todayCheckIns || 0) + '</span>' +
        '<span class="chip">Departures: ' + (avail.todayCheckOuts || 0) + '</span>' +
        '<span class="chip">Upcoming stays: ' + (avail.upcomingStays || 0) + '</span>' +
        '</div></div>' +
        '<table class="table"><thead><tr><th>Room</th><th>Status</th><th>Occupation</th><th>Today</th></tr></thead><tbody>' +
        snap.map(function (r) {
          return '<tr><td><strong>' + window.AdminUI.esc(r.name) + '</strong></td>' +
            '<td>' + window.AdminUI.esc(r.status || '') + '</td>' +
            '<td>' + (r.currentGuest ? window.AdminUI.esc(r.currentGuest) : '—') + '</td>' +
            '<td>' + availabilityPill(r) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +

        '<div class="grid-2">' +
        '<div class="card"><div class="card-head"><h3>Revenue (last 6 months)</h3></div>' +
        '<div class="bars">' +
        (data.revenueByMonth || []).map(function (r) {
          const h = Math.max(4, Math.round(((r.revenue || 0) / maxRev) * 120));
          return '<div class="bar-col"><div class="bar" style="height:' + h + 'px" title="' + window.AdminUI.inr(r.revenue) + '"></div><div class="bar-label">' + r.month.slice(5) + '</div></div>';
        }).join('') +
        '</div></div>' +

        '<div class="card"><div class="card-head"><h3>Recent bookings</h3></div>' +
        '<ul class="mini-list">' +
        recents.map(function (b) {
          const who = b.guestName || (b.user ? b.user.name : 'Guest');
          return '<li><span class="mll-name">' + window.AdminUI.esc(b.room ? b.room.name : 'Room') +
            '</span><span>' + window.AdminUI.esc(who) + '</span>' +
            '<span class="mini-date">' + window.AdminUI.fmtDate(b.checkIn) + ' → ' + window.AdminUI.fmtDate(b.checkOut) + '</span>' +
            '<span class="status-tag s-' + (b.status || 'pending') + '">' + window.AdminUI.statusLabel(b.status) + '</span></li>';
        }).join('') +
        '</ul></div></div>';
    }).catch(function (err) {
      stage.innerHTML = '<div class="card error-card">' + window.AdminUI.esc(err.message) + '</div>';
    });
  };
})();