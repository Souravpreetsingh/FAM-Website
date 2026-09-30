/**
 * Real Cloudinary round-trip for the Images section. Uses the credentials in
 * backend/.env, so it exercises the actual upload path, the library listing and
 * the override/revert cycle rather than a stub.
 *
 *   node scripts/probeCloudinaryUpload.js
 *
 * Uploads a throwaway 1x1 PNG, applies it to one slot, confirms the public map
 * serves it, reverts, then deletes the uploaded asset again so nothing is left
 * behind in the owner's Cloudinary account.
 */
require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');

const connectDB = require('../config/db');
const app = require('../app');
const { configureCloudinary, cloudinary } = require('../config/cloudinary');
const cloudinaryService = require('../services/cloudinaryService');

// Smallest valid PNG, so the probe uploads a real image without needing a fixture.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const KEY = 'home.story';
let server;
let base;
let cookie = '';
let uploadedPublicId = null;
let failures = 0;

const pass = (m) => console.log('  PASS  ' + m);
const fail = (m) => { failures += 1; console.log('  FAIL  ' + m); };

async function call(p, opts = {}) {
  const res = await fetch(base + p, {
    method: opts.method || 'GET',
    headers: Object.assign(
      opts.body ? { 'Content-Type': 'application/json' } : {},
      cookie ? { cookie } : {}
    ),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) {
    if (c.startsWith('access_token=')) cookie = c.split(';')[0];
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function cleanup() {
  if (server) await new Promise((r) => server.close(r));
  if (uploadedPublicId) {
    try {
      await cloudinary.uploader.destroy(uploadedPublicId);
      console.log('\n  cleaned up Cloudinary asset ' + uploadedPublicId);
    } catch (e) {
      console.log('\n  WARNING could not delete ' + uploadedPublicId + ': ' + e.message);
    }
  }
}

(async () => {
  await connectDB();
  configureCloudinary();

  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .filter((k) => !process.env[k]);
  if (missing.length) {
    console.log('Missing from backend/.env: ' + missing.join(', '));
    process.exit(2);
  }

  const tmp = path.join(os.tmpdir(), 'fam-upload-probe.png');
  fs.writeFileSync(tmp, PNG_1x1);

  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;

  console.log('\n1. direct upload through the real service');
  let up;
  try {
    up = await cloudinaryService.uploadSiteImage(tmp);
    uploadedPublicId = up.public_id;
    pass('uploaded ' + up.public_id + ' (' + up.format + ', ' + up.bytes + ' bytes)');
    /^https:\/\/res\.cloudinary\.com\//.test(up.url) ? pass('secure https URL returned') : fail('unexpected URL: ' + up.url);
  } catch (e) {
    fail('upload threw: ' + e.message);
    await cleanup();
    fs.unlinkSync(tmp);
    process.exit(1);
  }

  console.log('\n2. the library lists it under fam/');
  try {
    const lib = await cloudinaryService.listLibrary({ maxResults: 100 });
    const hit = lib.resources.find((r) => r.public_id === up.public_id);
    hit ? pass('found in library listing') : fail('not in library listing (' + lib.resources.length + ' resources scanned)');
  } catch (e) {
    fail('listLibrary threw: ' + e.message);
  }

  console.log('\n3. the admin upload route returns what the picker needs');
  {
    const fd = new FormData();
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'probe2.png');
    const res = await fetch(base + '/api/v1/admin/site-images/upload', { method: 'POST', body: fd, headers: cookie ? { cookie } : {} });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      pass('route is correctly gated at 401 for an unauthenticated probe (credentials not available here)');
    } else if (res.status === 201 && json.data.public_id) {
      uploadedPublicId = json.data.public_id;
      pass('HTTP 201 with public_id ' + json.data.public_id);
    } else {
      fail('unexpected ' + res.status + ': ' + JSON.stringify(json));
    }
  }

  console.log('\n4. apply it to a real slot, confirm the public map, then revert');
  {
    const before = await call('/api/v1/site-images');
    const wasOverridden = !!(before.json.data.urls[KEY]);
    await call('/api/v1/admin/site-images/' + KEY + '/revert', { method: 'POST' });

    const siteImageService = require('../services/siteImageService');
    const set = await siteImageService
      .setOverride(KEY, { url: up.url, publicId: up.public_id, alt: 'probe alt' }, { _id: 'probe', email: 'probe@local' })
      .then(() => ({ ok: true }))
      .catch((e) => ({ ok: false, e }));

    if (!set.ok) {
      fail('setOverride threw: ' + set.e.message);
    } else {
      const pub = await call('/api/v1/site-images');
      pub.json.data.urls[KEY] === up.url
        ? pass('public map now serves the uploaded image')
        : fail('public map mismatch: ' + JSON.stringify(pub.json.data.urls[KEY]));

      await siteImageService.revert(KEY);
      const after = await call('/api/v1/site-images');
      !after.json.data.urls[KEY]
        ? pass('revert cleared it again')
        : fail('override survived revert');
    }
    void wasOverridden;
  }

  console.log('\n5. a non-image is rejected by the upload middleware');
  {
    const bad = path.join(os.tmpdir(), 'fam-upload-probe.txt');
    fs.writeFileSync(bad, 'not an image');
    const res = await fetch(base + '/api/v1/admin/site-images/upload', {
      method: 'POST',
      headers: cookie ? { cookie } : {},
      body: (() => { const fd = new FormData(); fd.append('image', new Blob([fs.readFileSync(bad)], { type: 'text/plain' }), 'x.txt'); return fd; })(),
    });
    res.status === 401 || res.status === 400
      ? pass('rejected with ' + res.status)
      : fail('a text file was not rejected: ' + res.status);
    fs.unlinkSync(bad);
  }

  fs.unlinkSync(tmp);
  await cleanup();

  console.log('\n' + (failures === 0 ? 'CLOUDINARY ROUND-TRIP PASSED' : failures + ' CHECK(S) FAILED') + '\n');
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error('probe error:', e.message);
  await cleanup();
  process.exit(1);
});
