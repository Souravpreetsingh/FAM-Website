const AdminAPI = (function () {
  const BASE = '/api/v1/admin';

  function attemptRefresh() {
    return fetch(BASE + '/refresh', {
      method: 'POST',
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return false;
      return res.json().catch(function () { return false; }).then(function (body) {
        if (body && body.data && body.data.user) window.AdminAuth.setUser(body.data.user);
        return true;
      });
    }).catch(function () { return false; });
  }

  function request(path, opts, allowRefresh) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    return fetch(BASE + path, Object.assign({}, opts, {
      credentials: 'include',
      headers: headers,
    })).then(function (res) {
      return res.json().catch(function () {
        return null;
      }).then(function (body) {
        if (res.status === 401) {
          if (allowRefresh !== false) {
            return attemptRefresh().then(function (refreshed) {
              if (refreshed) return request(path, opts, false);
              window.AdminAuth.logout();
              throw new Error('Session expired. Please log in again.');
            });
          }
          window.AdminAuth.logout();
          throw new Error('Session expired. Please log in again.');
        }
        if (!res.ok || (body && body.success === false)) {
          throw new Error((body && body.message) || ('Request failed (' + res.status + ')'));
        }
        return body ? body.data : null;
      });
    });
  }

  return {
    get: function (path) {
      return request(path);
    },
    post: function (path, data) {
      return request(path, { method: 'POST', body: JSON.stringify(data || {}) });
    },
    put: function (path, data) {
      return request(path, { method: 'PUT', body: JSON.stringify(data || {}) });
    },
    patch: function (path, data) {
      return request(path, { method: 'PATCH', body: JSON.stringify(data || {}) });
    },
    del: function (path) {
      return request(path, { method: 'DELETE' });
    },
  };
})();
window.AdminAPI = AdminAPI;
