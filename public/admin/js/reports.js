(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;

  function monthLabel(m) {
    return (m || '').toString().slice(0, 7);
  }

  async function load() {
    const stage = document.getElementById('repView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    try {
      const now = new Date();
      const occ = await window.AdminAPI.get('/reports/occupancy?month=' + now.getMonth() + '&year=' + now.getFullYear());
      const popular = await window.AdminAPI.get('/reports/popular-rooms?limit=6');
      const trends = await window.AdminAPI.get('/reports/trends?months=12');
      const revenue = await window.AdminAPI.get('/revenue');
      render(stage, occ || {}, popular || {}, trends || {}, revenue || {});
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(err.message) + '</div>';
    }
  }

  function render(stage, occ, popular, trends, revenue) {
    const occRows = (occ.roomStats || []).map(function (r) {
      return '<tr><td><strong>' + U.esc(r.roomName) + '</strong></td>' +
        '<td>' + (r.bookedNights || 0) + ' / ' + (r.totalPossibleNights || 0) + '</td>' +
        '<td>' + (r.occupancyRate !== undefined ? r.occupancyRate.toFixed(1) + '%' : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="muted">No occupancy data.</td></tr>';

    const popRows = (popular.popular || []).map(function (r) {
      return '<tr><td><strong>' + U.esc(r.roomName) + '</strong></td>' +
        '<td>' + (r.bookings || 0) + '</td>' +
        '<td>' + U.inr(r.totalRevenue) + '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="muted">No popular-room data.</td></tr>';

    const t = trends.trends || [];
    const maxRev = t.reduce(function (m, r) { return Math.max(m, r.revenue || 0); }, 0) || 1;
    const trendBars = t.length
      ? '<div class="bars">' + t.map(function (r) {
          const h = Math.max(4, Math.round(((r.revenue || 0) / maxRev) * 120));
          return '<div class="bar-col" title="' + U.inr(r.revenue) + '"><div class="bar" style="height:' + h + 'px"></div>' +
            '<div class="bar-label">' + U.esc(monthLabel(r.month)) + '</div></div>';
        }).join('') + '</div>'
      : '<p class="muted">No trend data available.</p>';

    stage.innerHTML =
      '<div class="grid-2">' +
      '<div class="card"><div class="card-head"><h3>Occupancy (this month)</h3>' +
      '<span class="chip">Overall: ' + (occ.overallOccupancy !== undefined ? occ.overallOccupancy.toFixed(1) + '%' : '—') + '</span></div>' +
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Room</th><th>Booked nights</th><th>Rate</th></tr></thead>' +
      '<tbody>' + occRows + '</tbody></table></div></div>' +

      '<div class="card"><div class="card-head"><h3>Popular rooms</h3></div>' +
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Room</th><th>Bookings</th><th>Revenue</th></tr></thead>' +
      '<tbody>' + popRows + '</tbody></table></div></div>' +

      '<div class="card"><div class="card-head"><h3>Revenue trend (12 months)</h3>' +
      '<span class="chip">Total: ' + (revenue.totalRevenue !== undefined ? U.inr(revenue.totalRevenue) : '—') + '</span></div>' +
      trendBars + '</div>' +

      '<div class="card"><div class="card-head"><h3>Revenue by room</h3></div>' +
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Room</th><th>Revenue</th><th>Bookings</th></tr></thead><tbody>' +
      ((revenue.revenueByRoom || []).map(function (r) {
        return '<tr><td><strong>' + U.esc(r.roomName || '—') + '</strong></td>' +
          '<td>' + U.inr(r.revenue) + '</td><td>' + (r.bookings || 0) + '</td></tr>';
      }).join('') || '<tr><td colspan="3" class="muted">No revenue data.</td></tr>') +
      '</tbody></table></div></div></div>';
  }

  window.AdminViews.reports = function (stage) {
    stage.id = 'repView';
    load();
  };
})();