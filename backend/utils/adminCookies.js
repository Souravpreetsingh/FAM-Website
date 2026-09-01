/** Admin session cookies — httpOnly, SameSite, Secure in prod. */
function adminCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
}

/**
 * Set the httpOnly admin access/refresh cookies on a response. Shared so the
 * admin login route and (admins signing in via the public route) behave the
 * same way: tokens live in cookies, never in JavaScript.
 */
function setAdminAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie('access_token', accessToken, Object.assign({}, adminCookieOptions(), {
    maxAge: 15 * 60 * 1000,
  }));
  res.cookie('refresh_token', refreshToken, Object.assign({}, adminCookieOptions(), {
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }));
}

function clearAdminAuthCookies(res) {
  res.clearCookie('access_token', adminCookieOptions());
  res.clearCookie('refresh_token', adminCookieOptions());
}

module.exports = { setAdminAuthCookies, clearAdminAuthCookies, adminCookieOptions };