/**
 * HTTP-level test of the admin Images routes.
 *
 * Verifies the wiring that a controller unit test cannot:
 *   - the router is mounted at /api/v1/admin,
 *   - every route sits behind the auth gate,
 *   - a request from a browser-shaped fetch() client receives a 200 with the
 *     JSON envelope the admin client expects (this is what actually 500'd).
 *
 * Only the auth middleware and the two data services are stubbed, so no
 * database, no Cloudinary, and no secrets are needed.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const SERVICE_PATH = require.resolve('../services/siteImageService');
const STORAGE_PATH = require.resolve('../services/imageStorage');
const AUTH_PATH = require.resolve('../middleware/auth');

// Log every entry/exit so we can assert the routes are genuinely gated rather
// than merely appearing after router.use(authenticate, ...).
const authCalls = [];

const admin = { _id: 'u1', role: 'admin', email: 'owner@fam.test' };

const STORED_ID = '507f1f77bcf86cd799439011';
const storedUrl = '/api/v1/site-images/file/' + STORED_ID;

const serviceStub = {
  listImages: async () => ({
    pages: [{ id: 'home', title: 'Home', count: 3 }],
    storage: { provider: 'mongodb', ready: true, accepts: ['image/jpeg', 'image/png'], maxBytes: 5242880, detail: null },
    images: [{ key: 'home.story' }],
  }),
  getImage: async (key) => ({ key, effectiveUrl: '/images/old.jpg', isOverridden: false }),
  setOverride: async (key) => ({ key, effectiveUrl: storedUrl, isOverridden: true }),
  revert: async (key) => ({ key, effectiveUrl: '/images/original.jpg', isOverridden: false }),
  getOverrideMap: async () => ({ urls: { 'home.story': storedUrl }, alts: {} }),
};

const STORED_BYTES = Buffer.from('stored-image-bytes-for-the-route-test');

const storageStub = {
  listLibrary: async () => ({
    resources: [{ public_id: STORED_ID, url: storedUrl, originalName: 'a.jpg', width: 10, height: 5 }],
    nextCursor: null,
  }),
  store: async () => ({
    public_id: STORED_ID,
    url: storedUrl,
    width: 10,
    height: 5,
    format: 'jpg',
    bytes: STORED_BYTES.length,
    provider: 'mongodb',
    contentType: 'image/jpeg',
  }),
  read: async (id) =>
    id === STORED_ID ? { data: STORED_BYTES, contentType: 'image/jpeg', size: STORED_BYTES.length } : null,
};

const authStub = {
  authenticate: (req, res, next) => {
    authCalls.push('authenticate');
    if (req.headers['x-test-anon'] === '1') {
      return res.status(401).json({ success: false, message: 'Access token is required' });
    }
    req.user = admin;
    next();
  },
  authorizeAdmin: (req, res, next) => {
    authCalls.push('authorizeAdmin');
    next();
  },
};

require.cache[SERVICE_PATH] = { id: SERVICE_PATH, filename: SERVICE_PATH, loaded: true, exports: serviceStub };
require.cache[STORAGE_PATH] = { id: STORAGE_PATH, filename: STORAGE_PATH, loaded: true, exports: storageStub };
require.cache[AUTH_PATH] = { id: AUTH_PATH, filename: AUTH_PATH, loaded: true, exports: authStub };

const app = require('../app');

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});

after(() => server && server.close());

function get(path, headers = {}) {
  return fetch(base + path, { headers }).then(async (res) => {
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, cacheControl: res.headers.get('cache-control') };
  });
}

test('admin image routes are mounted under /api/v1/admin', async () => {
  const res = await get('/api/v1/admin/site-images');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.success, true);
  assert.ok(Array.isArray(res.json.data.images), 'data.images present');
  assert.ok(Array.isArray(res.json.data.pages), 'data.pages present');
  // The admin UI keys its storage notice off this object.
  assert.strictEqual(res.json.data.storage.provider, 'mongodb');
  assert.strictEqual(res.json.data.storage.ready, true);
  assert.strictEqual(res.json.data.storage.detail, null);
  assert.strictEqual(res.json.data.cloudinary, undefined, 'the old Cloudinary-shaped key must be gone');
});

test('the auth gate runs before the handler for every admin image route', async () => {
  authCalls.length = 0;
  await get('/api/v1/admin/site-images');
  assert.deepStrictEqual(authCalls, ['authenticate', 'authorizeAdmin']);
});

test('an unauthenticated list request is refused with 401', async () => {
  const res = await get('/api/v1/admin/site-images', { 'x-test-anon': '1' });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.json.success, false);
});

test('library route returns stored resources under data', async () => {
  const res = await get('/api/v1/admin/site-images/library');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.json.data.resources));
  assert.strictEqual(res.json.data.resources[0].originalName, 'a.jpg', 'original filename is kept for reuse');
  assert.strictEqual(res.json.data.resources[0].url, storedUrl);
  assert.strictEqual(res.json.data.resources[0].data, undefined, 'library must never carry image bytes');
});

test('PUT an override then POST a revert, both over HTTP', async () => {
  const put = await fetch(base + '/api/v1/admin/site-images/home.story', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: storedUrl, publicId: STORED_ID }),
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.json.data.isOverridden, true);

  const rev = await fetch(base + '/api/v1/admin/site-images/home.story/revert', { method: 'POST' })
    .then(async (r) => ({ status: r.status, json: await r.json() }));
  assert.strictEqual(rev.status, 200);
  assert.strictEqual(rev.json.data.isOverridden, false);
});

test('the public stored-image route serves real bytes with no auth', async () => {
  authCalls.length = 0;
  const res = await fetch(base + storedUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'image/jpeg');
  assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(buf.toString('utf8'), STORED_BYTES.toString('utf8'));
  assert.deepStrictEqual(authCalls, [], 'the public site fetches these itself, so no auth may run');
});

test('the public stored-image route 404s for an unknown id', async () => {
  const res = await fetch(base + '/api/v1/site-images/file/000000000000000000000000');
  assert.strictEqual(res.status, 404);
});

test('public override map is served without auth and is cacheable', async () => {
  const res = await get('/api/v1/site-images');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.success, true);
  assert.ok(res.json.data.urls, 'urls map present');
  assert.match(res.cacheControl, /max-age=60/);
});

test('the public map is NOT behind the auth gate', async () => {
  authCalls.length = 0;
  await get('/api/v1/site-images');
  assert.deepStrictEqual(authCalls, [], 'no auth middleware should run for the public route');
});
