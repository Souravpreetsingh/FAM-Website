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
const CLOUDINARY_PATH = require.resolve('../services/cloudinaryService');

const serviceStub = {
  listImages: async () => ({
    pages: [{ id: 'home', title: 'Home', count: 3 }],
    cloudinary: { ready: true, missing: [], placeholder: [] },
    images: [{ key: 'home.story' }],
  }),
  getImage: async (key) => ({ key, effectiveUrl: '/images/old.jpg', isOverridden: false }),
  setOverride: async (key) => ({ key, effectiveUrl: 'https://res.cloudinary.com/demo/new.jpg', isOverridden: true }),
  revert: async (key) => ({ key, effectiveUrl: '/images/original.jpg', isOverridden: false }),
  getOverrideMap: async () => ({ urls: {}, alts: {} }),
};

const cloudinaryStub = {
  listLibrary: async () => ({ resources: [], nextCursor: null }),
  uploadSiteImage: async () => ({ public_id: 'fam/site/new', url: 'https://res.cloudinary.com/demo/new.jpg' }),
};

// Swap the stubs in before the controller (and therefore the real services) is
// loaded, so nothing here can touch MongoDB or Cloudinary.
const realService = require.cache[SERVICE_PATH];
const realCloudinary = require.cache[CLOUDINARY_PATH];
require.cache[SERVICE_PATH] = { id: SERVICE_PATH, filename: SERVICE_PATH, loaded: true, exports: serviceStub };
require.cache[CLOUDINARY_PATH] = { id: CLOUDINARY_PATH, filename: CLOUDINARY_PATH, loaded: true, exports: cloudinaryStub };

const controller = require('../controllers/siteImageController');

test.after(() => {
  if (realService) require.cache[SERVICE_PATH] = realService; else delete require.cache[SERVICE_PATH];
  if (realCloudinary) require.cache[CLOUDINARY_PATH] = realCloudinary; else delete require.cache[CLOUDINARY_PATH];
});

// Minimal Express-shaped response recorder.
function fakeRes() {
  const rec = { statusCode: 200, body: undefined, ended: false };
  rec.status = (code) => { rec.statusCode = code; return rec; };
  rec.json = (payload) => { rec.body = payload; rec.ended = true; return rec; };
  rec.set = () => rec;
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
  // The admin UI keys its "Cloudinary is not configured" notice off this object.
  assert.strictEqual(res.body.data.cloudinary.ready, true);
  assert.deepStrictEqual(res.body.data.cloudinary.missing, []);
  assert.deepStrictEqual(res.body.data.cloudinary.placeholder, []);
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

test('uploadImage responds 201 with the Cloudinary result under data', async () => {
  const res = await call(controller.uploadImage, { user: admin, file: { path: 'x.jpg' } });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.public_id, 'fam/site/new');
});

test('updateImage responds 200 with the new effectiveUrl', async () => {
  const res = await call(controller.updateImage, {
    user: admin,
    params: { key: 'home.story' },
    body: { url: 'https://res.cloudinary.com/demo/new.jpg', publicId: 'fam/site/new' },
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.effectiveUrl, 'https://res.cloudinary.com/demo/new.jpg');
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
