(function () {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    fetch('/api/v1/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return null;
        }).then(function (body) {
          if (!res.ok) throw new Error((body && body.message) || 'Login failed');
          return body ? body.data : null;
        });
      })
      .then(function (data) {
        window.AdminAuth.set(data.accessToken);
        window.AdminAuth.setUser(data.user);
        window.location.href = '/admin/index.html';
      })
      .catch(function (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Sign in';
      });
  });
})();