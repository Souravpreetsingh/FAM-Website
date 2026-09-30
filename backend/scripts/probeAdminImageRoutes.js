/**
 * End-to-end HTTP check of the admin Images routes, exercising the real
 * Express app with a genuine admin session cookie. Proves the routes answer
 * 200 (not 500) and that a full set + revert cycle works over HTTP.
 *
 *   node scripts/probeAdminImageRoutes.js
 *
 * Requires ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env.
 */
require('dotenv').config();

const connectDB = require('../config/db');
const app = require('../app');
const { configureCloudinary } = require('../config/cloudinary');

const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

let cookie = '';

async function call(path, opts = {}) {
  const res = await fetch('http://127.0.0.1:' + PORT + path, {
    method: opts.method || 'GET',
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookie) {
    if (c.startsWith('access_token=')) cookie = c.split(';')[0];
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

let PORT = 0;
const fail = (m) => { console.log('  FAIL  ' + m); process.exitCode = 1; };
const pass = (m) => console.log('  PASS  ' + m);

(async () => {
  if (!EMAIL || !PASSWORD) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set - cannot run authenticated probe.');
    process.exit(2);
  }

  await connectDB();
  configureCloudinary();

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  PORT = server.address().port;

  console.log('\n1. login');
  const login = await call('/api/v1/admin/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  login.status === 200 && cookie ? pass('authenticated, cookie captured') : fail('login failed: ' + login.status + ' ' + login.text.slice(0, 200));
  if (process.exitCode) { server.close(); process.exit(1); }

  console.log('\n2. GET /site-images');
  const list = await call('/api/v1/admin/site-images');
  if (list.status !== 200) fail('expected 200, got ' + list.status + ' :: ' + list.text.slice(0, 300));
  else if (!list.json || !Array.isArray(list.json.data.images)) fail('missing data.images envelope :: ' + list.text.slice(0, 300));
  else if (list.json.data.images.length !== 132) fail('expected 132 images, got ' + list.json.data.images.length);
  else pass('200, ' + list.json.data.images.length + ' images across ' + list.json.data.pages.length + ' pages');

  console.log('\n3. GET /site-images/library');
  const lib = await call('/api/v1/admin/site-images/library?limit=2');
  if (lib.status === 200) pass('200, ' + (Array.isArray(lib.json.data.resources) ? lib.json.data.resources.length + ' resources' : 'no resources'));
  else if (lib.status === 503) pass('503 Cloudinary not configured locally (expected without CLOUDINARY_* set) :: ' + (lib.json.message || '').slice(0, 120));
  else fail('unexpected ' + lib.status + ' :: ' + lib.text.slice(0, 200));

  console.log('\n4. set an override, read it back publicly, then revert');
  const key = 'home.story';
  const set = await call('/api/v1/admin/site-images/' + key, {
    method: 'PUT',
    body: { url: 'https://res.cloudinary.com/demo/image/upload/probe.jpg', publicId: 'probe/probe', alt: 'probe' },
  });
  set.status === 200 && set.json.data.isOverridden === true
    ? pass('override applied over HTTP')
    : fail('set failed: ' + set.status + ' :: ' + set.text.slice(0, 200));

  const pub = await fetch('http://127.0.0.1:' + PORT + '/api/v1/site-images').then((r) => r.json());
  pub.data && pub.data.urls[key] === 'https://res.cloudinary.com/demo/image/upload/probe.jpg'
    ? pass('public endpoint now serves the override')
    : fail('public map did not reflect override :: ' + JSON.stringify(pub.data));

  const rev = await call('/api/v1/admin/site-images/' + key + '/revert', { method: 'POST' });
  rev.status === 200 && rev.json.data.isOverridden === false
    ? pass('reverted')
    : fail('revert failed: ' + rev.status + ' :: ' + rev.text.slice(0, 200));

  const pub2 = await fetch('http://127.0.0.1:' + PORT + '/api/v1/site-images').then((r) => r.json());
  !(pub2.data.urls[key])
    ? pass('public map clean again')
    : fail('override survived revert :: ' + JSON.stringify(pub2.data));

  console.log('\n5. reject a non-https override');
  const bad = await call('/api/v1/admin/site-images/' + key, { method: 'PUT', body: { url: 'http://evil.example/x.jpg' } });
  bad.status === 400 ? pass('400 as expected') : fail('expected 400, got ' + bad.status + ' :: ' + bad.text.slice(0, 200));

  console.log('\n' + (process.exitCode ? 'SOME CHECKS FAILED' : 'ALL ADMIN IMAGE ROUTE CHECKS PASSED') + '\n');
  server.close();
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error('probe error:', e.message); process.exit(1); });
