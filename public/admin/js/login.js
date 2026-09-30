(function () {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.hidden = true;

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // The form is marked novalidate, so the browser will not stop an empty
    // submit. Catching it here gives an immediate answer instead of a round trip
    // that comes back as a bare 400.
    if (!email || !password) {
      errorEl.textContent = !email && !password
        ? 'Enter your email and password.'
        : !email
          ? 'Enter your email address.'
          : 'Enter your password.';
      errorEl.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in…';

    // Tokens are set as httpOnly cookies by the server; nothing sensitive is
    // stored in JavaScript.
    fetch('/api/v1/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return null;
        }).then(function (body) {
          if (!res.ok) {
            // The server reports why in body.errors (which field, and what is
            // wrong with it). Showing only body.message meant a bad email came
            // back as the word "Validation failed", which says nothing about
            // what to actually type.
            var details = body && body.errors
              ? body.errors
                  .map(function (err) { return err.message; })
                  .filter(Boolean)
                  .join(' ')
              : '';
            throw new Error(details || (body && body.message) || 'Login failed');
          }
          return body ? body.data : null;
        });
      })
      .then(function (data) {
        if (data && data.user) window.AdminAuth.setUser(data.user);
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
