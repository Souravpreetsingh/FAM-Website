const AdminAPI = (function () {
  const BASE = '/api/v1/admin';

  function request(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const t = window.AdminAuth.token();
    if (t) headers['Authorization'] = 'Bearer ' + t;

    return fetch(BASE + path, Object.assign({}, opts, { headers })).then(function (res) {
      return res.json().catch(function () {
        return null;
      }).then(function (body) {
        if (res.status === 401) {
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