(async function () {
  const hadStored = !!window.AdminAuth.user();
  let authed = hadStored;
  if (!authed) {
    authed = await window.AdminAuth.validateSession();
  } else {
    // Re-validate in the background so revoked/expired sessions are caught.
    window.AdminAuth.validateSession().then(function (ok) {
      if (!ok) window.AdminAuth.logout();
    });
  }
  if (!authed) {
    window.location.href = '/admin/login.html';
    return;
  }

  const viewsContainer = document.getElementById('views');
  const pageTitle = document.getElementById('pageTitle');
  const navList = document.getElementById('navList');

  const VIEWS = {
    dashboard: { title: 'Dashboard', render: function (el) { return AdminViews.dashboard(el); } },
    availability: { title: 'Availability', render: function (el) { return AdminViews.availability(el); } },
    reservations: { title: 'Reservations', render: function (el) { return AdminViews.reservations(el); } },
    rooms: { title: 'Rooms', render: function (el) { return AdminViews.rooms(el); } },
    customers: { title: 'Customers', render: function (el) { return AdminViews.customers(el); } },
    reports: { title: 'Reports', render: function (el) { return AdminViews.reports(el); } },
    settings: { title: 'Settings', render: function (el) { return AdminViews.settings(el); } },
  };

  function showView(name) {
    const view = VIEWS[name];
    if (!view) return;
    pageTitle.textContent = view.title;
    Array.prototype.forEach.call(navList.querySelectorAll('.nav-btn'), function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    viewsContainer.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'view-stage';
    viewsContainer.appendChild(stage);
    view.render(stage);
  }

  navList.addEventListener('click', function (e) {
    const btn = e.target.closest('.nav-btn[data-view]');
    if (btn) showView(btn.dataset.view);
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    window.location.href = '/';
  });
  document.getElementById('logoutBtn').addEventListener('click', function () {
    window.AdminAuth.logout();
  });

  const u = window.AdminAuth.user();
  if (u && u.name) document.getElementById('adminName').textContent = u.name;
  else if (u && u.email) document.getElementById('adminName').textContent = u.email;

  window.AdminUI.openModal = function (html) {
    const root = document.getElementById('modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal">' + html +
      '<button class="modal-close" data-close="1" aria-label="Close">&times;</button></div>';
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.hasAttribute('data-close')) wrap.remove();
    });
    root.innerHTML = '';
    root.appendChild(wrap);
    return wrap;
  };
  window.AdminUI.closeModal = function () {
    document.getElementById('modalRoot').innerHTML = '';
  };
  window.AdminUI.toast = function (msg, isErr) {
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  };

  showView('dashboard');
})();