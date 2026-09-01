(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;
  const PROFILE_API = '/api/v1/users/profile';

  function profileRequest(method, body) {
    const t = window.AdminAuth.token();
    const headers = { 'Content-Type': 'application/json' };
    // Tokens are held in httpOnly cookies; only attach a Bearer header when a
    // legacy token is actually present.
    if (t) headers['Authorization'] = 'Bearer ' + t;
    return fetch(PROFILE_API, {
      method: method,
      credentials: 'include',
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (b) {
        if (!res.ok) throw new Error((b && b.message) || 'Request failed');
        return b ? b.data : null;
      });
    });
  }

  function load() {
    const stage = document.getElementById('setView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    Promise.all([
      profileRequest('GET'),
      window.AdminAPI.get('/dashboard'),
    ]).then(function (results) {
      render(stage, (results[0] && results[0].user) || {}, (results[1] && results[1].stats) || {});
    }).catch(function (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(err.message) + '</div>';
    });
  }

  function render(stage, user, stats) {
    const admin = window.AdminAuth.user() || {};

    const hotelInfo =
      '<div class="card"><div class="card-head"><h3>Hotel information</h3></div>' +
      '<table class="table"><tbody>' +
      '<tr><td><strong>Name</strong></td><td>Flamingo aur Maina</td></tr>' +
      '<tr><td><strong>Brand</strong></td><td>Luxury hospitality — Himalayan retreat</td></tr>' +
      '<tr><td><strong>Rooms</strong></td><td>' + (stats.totalRooms !== undefined ? stats.totalRooms : '—') + ' registered</td></tr>' +
      '<tr><td><strong>Registered users</strong></td><td>' + (stats.totalUsers !== undefined ? stats.totalUsers : '—') + '</td></tr>' +
      '<tr><td><strong>Total revenue</strong></td><td>' + (stats.totalRevenue !== undefined ? U.inr(stats.totalRevenue) : '—') + '</td></tr>' +
      '</tbody></table>' +
      '<p class="muted" style="font-size:12px;margin-top:10px">Contact, shipping and booking numbers are managed by the server environment. These cannot be changed from this screen for safety.</p></div>';

    const profile =
      '<div class="card"><div class="card-head"><h3>Admin profile</h3></div>' +
      '<form id="profileForm" novalidate>' +
      '<label class="field"><span>Name *</span><input id="pfName" value="' + U.esc(user.name || admin.name || '') + '" /></label>' +
      '<label class="field"><span>Email</span><input id="pfEmail" value="' + U.esc(user.email || '') + '" disabled /></label>' +
      '<div class="sub">Role: ' + U.esc(user.role || 'admin') + ' · ' + (user.isVerified ? 'Verified' : 'Unverified') + '</div>' +
      '<button type="submit" class="btn btn-primary btn-block">Save name</button>' +
      '</form>' +
      '<div class="pager" style="margin-top:14px">' +
      '<a class="btn btn-ghost" href="/api/v1/users/change-password" style="text-decoration:none">Change password</a>' +
      '</div></div>';

    const bookings =
      '<div class="card"><div class="card-head"><h3>Booking &amp; availability settings</h3></div>' +
      '<table class="table"><tbody>' +
      '<tr><td><strong>Booking validation</strong></td><td>Server-side (never client-only)</td></tr>' +
      '<tr><td><strong>Double-booking protection</strong></td><td>Unique room/date index — last writer rejected</td></tr>' +
      '<tr><td><strong>Availability source</strong></td><td>Booking + AvailabilityBlock (maintenance/blocked)</td></tr>' +
      '<tr><td><strong>Priority</strong></td><td>Maintenance/blocked → booked → reserved → available</td></tr>' +
      '</tbody></table>' +
      '<p class="muted" style="font-size:12px;margin-top:10px">These rules are enforced by the backend and cannot be toggled here to avoid unsafe configuration.</p></div>';

    stage.innerHTML = '<div class="grid-2">' + hotelInfo + profile + '</div>' + bookings;

    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = document.getElementById('pfName').value.trim();
      if (!name) { window.AdminUI.toast('Name is required', true); return; }
      profileRequest('PUT', { name: name }).then(function (data) {
        const nu = data && data.user;
        if (nu) {
          const cu = window.AdminAuth.user() || {};
          cu.name = nu.name || cu.name;
          window.AdminAuth.setUser(cu);
          const el = document.getElementById('adminName');
          if (el) el.textContent = cu.name;
        }
        window.AdminUI.toast('Profile updated');
      }).catch(function (err) { window.AdminUI.toast(err.message, true); });
    });
  }

  window.AdminViews.settings = function (stage) {
    stage.id = 'setView';
    load();
  };
})();