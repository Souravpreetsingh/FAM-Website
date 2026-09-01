(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;

  const state = { page: 1, limit: 20, search: '', role: '' };

  function buildQuery() {
    let q = '/users?page=' + state.page + '&limit=' + state.limit;
    if (state.search) q += '&search=' + encodeURIComponent(state.search);
    if (state.role) q += '&role=' + state.role;
    return q;
  }

  function verifiedTag(u) {
    return u.isVerified
      ? '<span class="status-tag s-confirmed">Verified</span>'
      : '<span class="status-tag s-pending">Unverified</span>';
  }

  function roleTag(r) {
    return r === 'admin'
      ? '<span class="status-tag s-checked_in">Admin</span>'
      : '<span class="status-tag s-completed">Guest</span>';
  }

  function load() {
    const stage = document.getElementById('custView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    window.AdminAPI.get(buildQuery()).then(function (data) {
      render(stage, data);
    }).catch(function (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(err.message) + '</div>';
    });
  }

  function render(stage, data) {
    const users = data.users || [];
    const pag = data.pagination || {};

    let rows = users.map(function (u) {
      const id = u._id;
      return '<tr>' +
        '<td><strong>' + U.esc(u.name || '—') + '</strong></td>' +
        '<td>' + U.esc(u.email || '') + '</td>' +
        '<td>' + U.esc(u.phone || '—') + '</td>' +
        '<td>' + roleTag(u.role) + '</td>' +
        '<td>' + verifiedTag(u) + '</td>' +
        '<td>' + (u.bookingsCount !== undefined ? u.bookingsCount : '—') + '</td>' +
        '<td><button class="btn btn-xs" data-view="1" data-id="' + id + '">View</button>' +
        '<button class="btn btn-xs" data-role="1" data-id="' + id + '" data-roleval="' + (u.role === 'admin' ? 'guest' : 'admin') + '">' +
        (u.role === 'admin' ? 'Demote' : 'Make admin') + '</button></td>' +
        '</tr>';
    }).join('');

    if (!users.length) rows = '<tr><td colspan="7" class="muted">No customers found.</td></tr>';

    stage.innerHTML =
      '<div class="card"><div class="card-head"><h3>Customers</h3></div>' +
      '<div class="filters">' +
      '<input class="input" id="cSearch" placeholder="Search name or email" value="' + U.esc(state.search) + '" />' +
      '<select class="input" id="cRole">' +
      '<option value="">All roles</option>' +
      '<option value="guest"' + (state.role === 'guest' ? ' selected' : '') + '>Guest</option>' +
      '<option value="admin"' + (state.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
      '</select>' +
      '<button class="btn btn-ghost" id="cApply">Apply</button>' +
      '</div>' +
      '<div style="overflow-x:auto"><table class="table"><thead><tr>' +
      '<th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Bookings</th><th>Actions</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="pager">' +
      (pag.page > 1 ? '<button class="btn btn-ghost" data-nav="-1">‹ Prev</button>' : '<span></span>') +
      '<span class="muted">Page ' + pag.page + ' of ' + (pag.totalPages || 1) + '</span>' +
      (pag.page < pag.totalPages ? '<button class="btn btn-ghost" data-nav="1">Next ›</button>' : '<span></span>') +
      '</div></div>';

    stage.querySelector('#cApply').addEventListener('click', function () {
      state.search = stage.querySelector('#cSearch').value.trim();
      state.role = stage.querySelector('#cRole').value;
      state.page = 1;
      load();
    });
    stage.querySelector('#cSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') stage.querySelector('#cApply').click();
    });

    Array.prototype.forEach.call(stage.querySelectorAll('[data-nav]'), function (b) {
      b.addEventListener('click', function () { state.page += parseInt(b.dataset.nav, 10); load(); });
    });
    Array.prototype.forEach.call(stage.querySelectorAll('[data-role]'), function (b) {
      b.addEventListener('click', function () {
        const id = b.dataset.id;
        const role = b.dataset.roleval;
        if (!window.confirm('Set role to ' + role + '?')) return;
        window.AdminAPI.put('/users/' + id + '/role', { role: role }).then(function () {
          window.AdminUI.toast('Role updated');
          load();
        }).catch(function (e) { window.AdminUI.toast(e.message, true); });
      });
    });
    Array.prototype.forEach.call(stage.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () { openDetail(b.dataset.id); });
    });
  }

  function openDetail(id) {
    window.AdminUI.openModal('<h3>Customer</h3><div class="skeleton" id="custDetailBody">&nbsp;</div>');
    window.AdminAPI.get('/users/' + id).then(function (data) {
      const u = data.user || {};
      const bookings = (u.bookings || []).map(function (b) {
        return '<li class="mini-list" style="list-style:none;padding:6px 0;border-bottom:1px solid var(--border)">' +
          '<div><strong>' + U.esc((b.room && b.room.name) || 'Room') + '</strong> — ' +
          U.esc(b.guestName || b.user?.name || 'Guest') + '</div>' +
          '<div class="sub">' + U.fmtDate(b.checkIn) + ' → ' + U.fmtDate(b.checkOut) +
          ' · ' + U.esc(b.status || '') + ' · ' + U.inr(b.totalAmount) + '</div></li>';
      }).join('') || '<li class="muted">No bookings.</li>';
      document.getElementById('custDetailBody').parentElement.innerHTML =
        '<p><strong>' + U.esc(u.name || '—') + '</strong></p>' +
        '<div class="sub">' + U.esc(u.email || '') + '<br/>' + U.esc(u.phone || '') + '</div>' +
        '<div class="sub">Role: ' + U.esc(u.role || '') + ' · ' + (u.isVerified ? 'Verified' : 'Unverified') + '</div>' +
        '<hr/><h4 class="card-head" style="font-size:14px">Booking history</h4>' +
        '<ul style="list-style:none;margin:0;padding:0">' + bookings + '</ul>';
    }).catch(function (err) {
      window.AdminUI.toast(err.message, true);
      window.AdminUI.closeModal();
    });
  }

  window.AdminViews.customers = function (stage) {
    stage.id = 'custView';
    load();
  };
})();