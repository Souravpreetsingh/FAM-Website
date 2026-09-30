/**
 * Regression tests for the admin Images response envelope.
 *
 * Bug this guards against: the controller originally called
 * `new ApiResponse.success(...)`. ApiResponse.success is a *static factory*,
 * not a constructor, so `new` on it threw "ApiResponse.success is not a
 * constructor". asyncHandler forwarded the error to the Express error
 * handler and every admin image route answered 500, which made the whole
 * Images page unusable.
 *
 * These tests call the controller handlers directly with a fake res, so they
 * need no database and no network. They assert the exact JSON body the admin
 * client receives.
 */
const { test } = require('node:test');
const assert = require('node:assert');

const SERVICE_PATH = require.resolve('../services/siteImageService');
const STORAGE_PATH = require.resolve('../services/imageStorage');

const serviceStub = {
  listImages: async () => ({
    pages: [{ id: 'home', title: 'Home', count: 3 }],
    storage: { provider: 'mongodb', ready: true, accepts: ['image/jpeg'], maxBytes: 5242880, detail: null },
    images: [{ key: 'home.story' }],
  }),
  getImage: async (key) => ({ key, effectiveUrl: '/images/old.jpg', isOverridden: false }),
  setOverride: async (key) => ({ key, effectiveUrl: '/api/v1/site-images/file/507f1f77bcf86cd799439011', isOverridden: true }),
  revert: async (key) => ({ key, effectiveUrl: '/images/original.jpg', isOverridden: false }),
  getOverrideMap: async () => ({ urls: {}, alts: {} }),
};

const storageStub = {
  listLibrary: async () => ({ resources: [], nextCursor: null }),
  store: async () => ({
    public_id: '6abcc76956855fb0dad52c58',
    url: '/api/v1/site-images/file/6abcc76956855fb0dad52c58',
    width: 1600,
    height: 900,
    format: 'jpg',
    bytes: 179309,
    provider: 'mongodb',
    contentType: 'image/jpeg',
  }),
  read: async () => null,
};

// Swap the stubs in before the controller (and therefore the real services) is
// loaded, so nothing here can touch MongoDB or any third-party account.
const realService = require.cache[SERVICE_PATH];
const realStorage = require.cache[STORAGE_PATH];
require.cache[SERVICE_PATH] = { id: SERVICE_PATH, filename: SERVICE_PATH, loaded: true, exports: serviceStub };
require.cache[STORAGE_PATH] = { id: STORAGE_PATH, filename: STORAGE_PATH, loaded: true, exports: storageStub };

const controller = require('../controllers/siteImageController');

test.after(() => {
  if (realService) require.cache[SERVICE_PATH] = realService; else delete require.cache[SERVICE_PATH];
  if (realStorage) require.cache[STORAGE_PATH] = realStorage; else delete require.cache[STORAGE_PATH];
});

// Minimal Express-shaped response recorder.
function fakeRes() {
  const rec = { statusCode: 200, body: undefined, ended: false, headers: {} };
  rec.status = (code) => { rec.statusCode = code; return rec; };
  rec.json = (payload) => { rec.body = payload; rec.ended = true; return rec; };
  rec.set = (k, v) => { rec.headers[k] = v; return rec; };
  rec.send = (payload) => { rec.body = payload; rec.ended = true; return rec; };
  return rec;
}

async function call(handler, req) {
  const res = fakeRes();
  let failure = null;
  // asyncHandler forwards any throw to next(). Capture it so a regression
  // surfaces as a readable assertion instead of "undefined body".
  handler(req, res, (err) => { failure = err; });
  // asyncHandler does not return its promise, so awaiting the handler returns
  // immediately. Flush the microtask queue (and one macrotask, for the audit
  // write) so we assert against a settled response rather than a race.
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  if (failure) throw failure;
  return res;
}

const admin = { _id: 'u1', role: 'admin', email: 'owner@fam.test' };

test('getSiteImages responds 200 with the pages/images envelope', async () => {
  const res = await call(controller.getSiteImages, { user: admin });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.pages), 'pages array present');
  assert.ok(Array.isArray(res.body.data.images), 'images array present');
  assert.strictEqual(res.body.data.images.length, 1);
  // The admin UI keys its "uploads are going to the database" notice off this.
  assert.strictEqual(res.body.data.storage.provider, 'mongodb');
  assert.strictEqual(res.body.data.storage.ready, true);
  assert.deepStrictEqual(res.body.data.storage.detail, null);
  assert.ok(Array.isArray(res.body.data.storage.accepts), 'accepted types are advertised to the UI');
  assert.strictEqual(res.body.data.cloudinary, undefined, 'the old Cloudinary-shaped key must be gone');
});

test('getPublicOverrides responds 200 and sets a cacheable Cache-Control', async () => {
  const headers = {};
  const res = fakeRes();
  res.set = (k, v) => { headers[k] = v; return res; };
  await controller.getPublicOverrides({}, res, () => {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.deepStrictEqual(res.body.data, { urls: {}, alts: {} });
  assert.match(headers['Cache-Control'], /max-age=60/);
});

test('getLibrary responds 200 with a data envelope', async () => {
  const res = await call(controller.getLibrary, { user: admin, query: {} });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.resources));
});

test('uploadImage responds 201 with the stored result under data', async () => {
  const res = await call(controller.uploadImage, { user: admin, file: { path: 'x.jpg' } });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.public_id, '6abcc76956855fb0dad52c58');
  assert.strictEqual(res.body.data.provider, 'mongodb');
});

test('uploadImage deletes the staged temp file, success or failure', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const staged = path.join(os.tmpdir(), 'fam-upload-test-' + process.pid + '.jpg');
  try {
    fs.writeFileSync(staged, 'staged bytes');
    await call(controller.uploadImage, { user: admin, file: { path: staged } });
    assert.strictEqual(fs.existsSync(staged), false, 'temp file must not survive a successful upload');

    // Mutate the stub in place: the controller captured the module object when
    // it was required, so replacing require.cache exports would not be seen.
    const realStore = storageStub.store;
    storageStub.store = async () => { throw new Error('nope'); };
    try {
      fs.writeFileSync(staged, 'staged bytes');
      await assert.rejects(call(controller.uploadImage, { user: admin, file: { path: staged } }), /nope/);
      assert.strictEqual(fs.existsSync(staged), false, 'temp file must not survive a failed upload either');
    } finally {
      storageStub.store = realStore;
    }
  } finally {
    if (fs.existsSync(staged)) fs.unlinkSync(staged);
  }
});

test('getStoredImage sends the bytes with a sniffed content type', async () => {
  const bytes = Buffer.from('the-actual-image-bytes');
  const realRead = storageStub.read;
  storageStub.read = async () => ({ data: bytes, contentType: 'image/jpeg', size: bytes.length });
  try {
    const res = await call(controller.getStoredImage, { params: { id: '507f1f77bcf86cd799439011' } });
    assert.strictEqual(res.headers['Content-Type'], 'image/jpeg');
    assert.strictEqual(res.headers['X-Content-Type-Options'], 'nosniff');
    assert.strictEqual(res.headers['Content-Disposition'], 'inline');
    assert.match(res.headers['Cache-Control'], /immutable/);
    assert.ok(Buffer.isBuffer(res.body), 'raw bytes, not a JSON envelope');
    assert.strictEqual(res.body.toString('utf8'), 'the-actual-image-bytes');
  } finally {
    storageStub.read = realRead;
  }
});

test('getStoredImage 404s when the image is gone', async () => {
  const realRead = storageStub.read;
  storageStub.read = async () => null;
  try {
    let failure = null;
    const res = fakeRes();
    controller.getStoredImage({ params: { id: '507f1f77bcf86cd799439011' } }, res, (e) => { failure = e; });
    await new Promise((r) => setImmediate(r));
    assert.ok(failure, 'a missing image must produce an error, not an empty 200');
    assert.strictEqual(failure.statusCode, 404);
  } finally {
    storageStub.read = realRead;
  }
});

test('updateImage responds 200 with the new effectiveUrl', async () => {
  const res = await call(controller.updateImage, {
    user: admin,
    params: { key: 'home.story' },
    body: { url: '/api/v1/site-images/file/507f1f77bcf86cd799439011', publicId: '507f1f77bcf86cd799439011' },
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.effectiveUrl, '/api/v1/site-images/file/507f1f77bcf86cd799439011');
  assert.strictEqual(res.body.data.isOverridden, true);
});

test('revertImage responds 200 and reports isOverridden false', async () => {
  const res = await call(controller.revertImage, { user: admin, params: { key: 'home.story' } });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.isOverridden, false);
});

test('every admin handler emits a plain serialisable JSON body', async () => {
  // Guards the original bug directly: `new ApiResponse.success()` produced a
  // non-constructor call. If any handler reverts to that, it throws instead of
  // producing a body, and this assertion fails.
  const res = await call(controller.getSiteImages, { user: admin });
  assert.doesNotThrow(() => JSON.stringify(res.body));
  assert.strictEqual(typeof res.body, 'object');
  assert.ok(!(res.body instanceof Function));
  assert.ok(!Array.isArray(res.body));
});
