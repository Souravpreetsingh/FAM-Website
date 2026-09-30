/**
 * Full round-trip for the Images page against the real MongoDB, with no
 * Cloudinary account involved. This is the check that matters now that the
 * default provider is the database: upload -> served bytes -> public override
 * map -> library listing -> revert -> cleanup.
 *
 *   node scripts/probeImageStorage.js
 *
 * Uses a real JPEG from public/images so the byte sniffing is exercised on
 * production-shaped input, and removes everything it created afterwards.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const connectDB = require('../config/db');
const app = require('../app');
const imageStorage = require('../services/imageStorage');
const StoredImage = require('../models/StoredImage');
const SiteImage = require('../models/SiteImage');
const siteImageService = require('../services/siteImageService');
const { detectImage } = require('../services/imageBytes');

const KEY = 'home.story';
let server;
let base;
const created = [];
let failures = 0;

const pass = (m) => console.log('  PASS  ' + m);
const fail = (m) => { failures += 1; console.log('  FAIL  ' + m); };
const step = (m) => console.log('\n' + m);

/**
 * Records whatever override the slot already had, so cleanup can put it back.
 *
 * The database this runs against is the real one (it comes from .env), and
 * KEY is a live slot. Blindly calling revert() would destroy a genuine override
 * someone set through the admin panel.
 *
 * This must be called BEFORE anything touches the slot, and the captured value
 * is kept for cleanup. Re-reading the slot at cleanup time is not enough: by
 * then the probe has already reverted it, so it would capture the probe's own
 * damage and "restore" that instead of the owner's real setting.
 */
let original = null;

async function captureOriginal() {
  const doc = await SiteImage.findOne({ key: KEY }).lean();
  original = doc
    ? { url: doc.url || '', publicId: doc.publicId || '', alt: doc.alt || '' }
    : { url: '', publicId: '', alt: '' };
  return original;
}

async function restore() {
  if (!original) return;
  if (original.url || original.alt) {
    await siteImageService.setOverride(KEY, {
      url: original.url,
      publicId: original.publicId,
      alt: original.alt,
    }, { _id: null, email: 'probe@local' });
    console.log('  note  restored the pre-existing override on ' + KEY + ' (' + original.url + ')');
  } else {
    await siteImageService.revert(KEY);
    console.log('  note  ' + KEY + ' had no override before this probe, left clean');
  }
}

async function cleanup() {
  if (server) await new Promise((r) => server.close(r));
  for (const id of created) {
    try { await StoredImage.findByIdAndDelete(id); } catch {}
  }
  try {
    await restore();
  } catch (e) {
    console.log('  note  could not restore ' + KEY + ': ' + e.message);
  }
}

/** A real JPEG from the site's own assets, so this is production-shaped input. */
function pickRealImage() {
  const dir = path.join(__dirname, '..', '..', 'public', 'images');
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (/\.jpe?g$/i.test(e.name)) {
        const buf = fs.readFileSync(full);
        if (buf.length < 400 * 1024) return { full, buf };
      }
    }
  }
  throw new Error('no sample JPEG found under public/images');
}

(async () => {
  await connectDB();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;

  step('0. Provider selection');
  const st = imageStorage.status();
  console.log('  provider = ' + st.provider + ', ready = ' + st.ready + ', accepts = ' + st.accepts.join('/'));
  st.provider === 'mongodb' ? pass('defaults to the database, no external account') : fail('unexpected provider: ' + st.provider);
  st.ready ? pass('reports ready with the database connected') : fail('reports not ready: ' + st.detail);

  step('1. Rejects a non-image before touching the database');
  const before = await StoredImage.countDocuments();
  try {
    await imageStorage.store({ buffer: Buffer.from('<?php echo "hi"; ?>'), originalname: 'evil.php' });
    fail('a text file was accepted');
  } catch (e) {
    /not a readable image/.test(e.message) ? pass('rejected: "' + e.message.slice(0, 60) + '..."') : fail('wrong error: ' + e.message);
  }
  const afterReject = await StoredImage.countDocuments();
  afterReject === before ? pass('nothing was written to the database') : fail('a row was written anyway');

  const { full, buf } = pickRealImage();
  const detected = detectImage(buf);
  console.log('  using ' + path.basename(full) + ' (' + Math.round(buf.length / 1024) + 'KB, ' + detected.type + ' ' + detected.width + 'x' + detected.height + ')');

  step('2. Stores the real image');
  const stored = await imageStorage.store(
    { buffer: buf, originalname: path.basename(full), mimetype: 'image/jpeg' },
    { folder: 'fam/site', user: { _id: null, email: 'probe@local' } }
  );
  created.push(stored.public_id);
  pass('stored as ' + stored.public_id);
  stored.provider === 'mongodb' ? pass('provider reported as mongodb') : fail('provider: ' + stored.provider);
  stored.url === '/api/v1/site-images/file/' + stored.public_id ? pass('url is ' + stored.url) : fail('unexpected url: ' + stored.url);
  stored.width === detected.width && stored.height === detected.height
    ? pass('dimensions read from the bytes (' + stored.width + 'x' + stored.height + ')')
    : fail('dimensions wrong: ' + stored.width + 'x' + stored.height);

  step('3. Serves the bytes back over HTTP');
  const served = await fetch(base + stored.url);
  const servedBuf = Buffer.from(await served.arrayBuffer());
  served.status === 200 ? pass('HTTP 200') : fail('HTTP ' + served.status);
  served.headers.get('content-type') === detected.type
    ? pass('Content-Type is the detected type, not the request: ' + served.headers.get('content-type'))
    : fail('Content-Type: ' + served.headers.get('content-type'));
  served.headers.get('x-content-type-options') === 'nosniff' ? pass('nosniff set') : fail('nosniff missing');
  /immutable/.test(served.headers.get('cache-control') || '') ? pass('cached hard: ' + served.headers.get('cache-control')) : fail('cache-control: ' + served.headers.get('cache-control'));
  servedBuf.equals(buf) ? pass('returned bytes are byte-for-byte identical to what was uploaded') : fail('bytes differ (' + servedBuf.length + ' vs ' + buf.length + ')');

  step('4. Serves the same bytes a browser would request for an <img>');
  const asImg = await fetch(base + stored.url, { headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
  asImg.status === 200 && Number(asImg.headers.get('content-length')) === buf.length
    ? pass('served correctly with an image Accept header')
    : fail('browser-style request failed: ' + asImg.status);

  step('5. Rejects a bad or hostile id');
  for (const bad of ['not-an-id', '../../etc/passwd', '000000000000000000000000', "%2e%2e%2fetc"]) {
    const r = await fetch(base + '/api/v1/site-images/file/' + encodeURIComponent(bad));
    r.status === 404 ? pass('404 for ' + JSON.stringify(bad)) : fail(bad + ' returned ' + r.status);
  }
  const missing = await fetch(base + '/api/v1/site-images/file/' + '507f1f77bcf86cd799439011');
  missing.status === 404 ? pass('404 for a well-formed id that does not exist') : fail('returned ' + missing.status);

  step('6. Appears in the library for reuse');
  const lib = await imageStorage.listLibrary({ folder: 'fam/site', limit: 40 });
  const hit = lib.resources.find((r) => r.public_id === stored.public_id);
  hit ? pass('listed with filename "' + hit.originalName + '"') : fail('not listed');
  hit && hit.data === undefined ? pass('listing omits the image bytes') : fail('listing leaked bytes');
  hit && hit.width === stored.width ? pass('listing carries real dimensions') : fail('dimensions missing from listing');

  step('7. Applies to a live slot, then reverts');
  await captureOriginal();
  await siteImageService.revert(KEY);
  await siteImageService.setOverride(KEY, { url: stored.url, publicId: stored.public_id, alt: 'probe alt' }, { _id: null, email: 'probe@local' });
  const pub = await (await fetch(base + '/api/v1/site-images')).json();
  pub.data.urls[KEY] === stored.url ? pass('public map serves the uploaded image') : fail('public map: ' + JSON.stringify(pub.data.urls[KEY]));
  pub.data.alts[KEY] === 'probe alt' ? pass('alt text carried through') : fail('alt missing');
  const libImg = await siteImageService.listImages();
  libImg.images.find((i) => i.key === KEY);
  const slot = libImg.images.find((i) => i.key === KEY);
  slot && slot.effectiveUrl === stored.url && slot.isOverridden
    ? pass('admin list shows the override on ' + KEY)
    : fail('admin list did not reflect the override');
  libImg.storage && libImg.storage.provider === 'mongodb'
    ? pass('admin list reports storage status')
    : fail('no storage status in listImages');

  // The public page loader resolves the URL the same way the browser would.
  const abs = new URL(stored.url, base).href;
  const asBrowser = await fetch(abs);
  asBrowser.status === 200 ? pass('the URL a browser resolves (' + abs + ') works') : fail('browser-resolved URL failed: ' + asBrowser.status);

  await siteImageService.revert(KEY);
  const pub2 = await (await fetch(base + '/api/v1/site-images')).json();
  !pub2.data.urls[KEY] ? pass('revert cleared the override') : fail('override survived revert');

  step('8. Public endpoint still leaks nothing');
  const raw = JSON.stringify(pub2);
  /CLOUDINARY|api_secret|apiSecret|cloudinary/.test(raw)
    ? fail('public payload mentions storage internals: ' + raw.slice(0, 120))
    : pass('public payload is just urls and alts');

  await cleanup();
  console.log('\n' + (failures === 0 ? 'FULL IMAGE ROUND-TRIP PASSED (no Cloudinary needed)' : failures + ' CHECK(S) FAILED') + '\n');
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error('probe error:', e.message);
  await cleanup();
  process.exit(1);
});
