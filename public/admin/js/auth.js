(function () {
  const AdminAuth = {
    token: function () {
      return localStorage.getItem('fam_admin_token');
    },
    user: function () {
      try {
        return JSON.parse(localStorage.getItem('fam_admin_user') || 'null');
      } catch (e) {
        return null;
      }
    },
    set: function (t) {
      localStorage.setItem('fam_admin_token', t);
    },
    setUser: function (u) {
      localStorage.setItem('fam_admin_user', JSON.stringify(u || null));
    },
    requireAdmin: function () {
      if (!this.token()) {
        window.location.href = '/admin/login.html';
        return false;
      }
      return true;
    },
    logout: function () {
      localStorage.removeItem('fam_admin_token');
      localStorage.removeItem('fam_admin_user');
      window.location.href = '/admin/login.html';
    },
  };
  window.AdminAuth = AdminAuth;
  if (AdminAuth.token()) {
    document.body.classList.add('authed');
  }
})();