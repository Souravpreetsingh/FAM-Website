(function () {
  // Admin session state lives in sessionStorage (non-secret profile data only).
  // The actual access/refresh tokens are held in httpOnly cookies and are never
  // exposed to JavaScript, so they cannot be read from these fields.
  const USER_KEY = 'fam_admin_user';

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  const AdminAuth = {
    // Deprecated: returns null. Tokens are stored in httpOnly cookies only.
    token: function () {
      return null;
    },
    user: function () {
      return readUser();
    },
    setUser: function (u) {
      if (u === null || u === undefined) {
        sessionStorage.removeItem(USER_KEY);
        return;
      }
      sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    },
    set: function () {
      // no-op: tokens are managed via cookies, never stored in the browser.
    },
    // Internal: ask the server who we are. Returns a Promise<boolean>.
    _fetchSession: function () {
      return fetch('/api/v1/admin/session', { credentials: 'include' })
        .then(function (res) {
          if (res.status === 401) return false;
          return res.json().catch(function () { return null; })
            .then(function (body) {
              if (!body || body.success === false || !body.data || !body.data.user) return false;
              AdminAuth.setUser(body.data.user);
              return true;
            });
        })
        .catch(function () { return false; });
    },
    // Validate the session by asking the server. If the (short-lived) access
    // token has expired, rotate it once via the httpOnly refresh cookie before
    // giving up. Returns a Promise<boolean>.
    validateSession: function () {
      return AdminAuth._fetchSession().then(function (ok) {
        if (ok) return true;
        // Access token expired/missing but a refresh cookie may still be valid.
        return fetch('/api/v1/admin/refresh', { method: 'POST', credentials: 'include' })
          .then(function (res) {
            if (!res.ok) return false;
            return res.json().catch(function () { return null; })
              .then(function (body) {
                if (!body || body.success === false || !body.data || !body.data.user) return false;
                AdminAuth.setUser(body.data.user);
                return true;
              });
          })
          .catch(function () { return false; });
      });
    },
    // Synchronous guard used by the admin boot. If we have no stored session we
    // redirect immediately; otherwise the API client re-validates on first call.
    requireAdmin: function () {
      if (!this.user()) {
        window.location.href = '/admin/login.html';
        return false;
      }
      return true;
    },
    logout: function () {
      fetch('/api/v1/admin/logout', { method: 'POST', credentials: 'include' })
        .catch(function () {})
        .finally(function () {
          sessionStorage.removeItem(USER_KEY);
          window.location.href = '/admin/login.html';
        });
    },
  };
  window.AdminAuth = AdminAuth;
})();
