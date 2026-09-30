/**
 * Unit coverage for the database-backed image storage that makes the admin
 * Images page work without any third-party account.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const { detectImage, isSupportedImage, extensionFor, supportedTypes } = require('../services/imageBytes');
const storage = require('../services/imageStorage');

/* ── helpers to build real files ───────────────────────────────────────── */

function makePng(w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc = (b) => {
    let c = -1;
    for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  const raw = Buffer.alloc(h * (w + 1));
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ── imageBytes ────────────────────────────────────────────────────────── */

test('detects PNG dimensions from a real encoded file', () => {
  assert.deepStrictEqual(detectImage(makePng(12, 7)), { type: 'image/png', width: 12, height: 7 });
});

test('detects the JPEGs the site actually ships', () => {
  const dir = path.join(__dirname, '..', '..', 'public', 'images');
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.jpe?g$/i.test(e.name) && found.length < 5) found.push(full);
    }
  };
  walk(dir);
  assert.ok(found.length > 0, 'expected sample JPEGs in public/images');
  for (const f of found) {
    const d = detectImage(fs.readFileSync(f));
    assert.strictEqual(d.type, 'image/jpeg', path.basename(f));
    assert.ok(d.width > 0 && d.height > 0, 'dimensions for ' + path.basename(f));
  }
});

test('refuses anything that is not a real image', () => {
  const bad = [
    ['prose', 'just some text, not an image at all'],
    ['empty', ''],
    ['html', '<!DOCTYPE html><html><body>hi</body></html>'],
    ['svg with script', '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'],
    ['php', '<?php system($_GET["c"]); ?>'],
    ['pdf', '%PDF-1.7\n%binary'],
    ['zip', 'PK' + String.fromCharCode(3, 4)],
  ];
  for (const [label, text] of bad) {
    const buf = Buffer.from(text, 'latin1');
    const detected = buf.length >= 12 ? detectImage(buf) : null;
    assert.ok(!detected, label + ' must not be accepted as an image');
    assert.ok(!isSupportedImage(buf), label + ' isSupportedImage must be false');
  }
});

test('extensionFor maps detected types to file extensions', () => {
  assert.strictEqual(extensionFor('image/jpeg'), 'jpg');
  assert.strictEqual(extensionFor('image/png'), 'png');
  assert.strictEqual(extensionFor('image/webp'), 'webp');
  assert.strictEqual(extensionFor('image/gif'), 'gif');
  assert.strictEqual(extensionFor('image/svg+xml'), 'bin', 'unknown types must not become html-ish');
});

test('supportedTypes covers the formats the admin UI advertises', () => {
  assert.deepStrictEqual(supportedTypes(), ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
});

/* ── provider selection ────────────────────────────────────────────────── */

test('defaults to the database when IMAGE_STORAGE is unset', () => {
  assert.strictEqual(storage.requestedProvider({}), 'mongodb');
  assert.strictEqual(storage.activeProvider({}), 'mongodb');
});

test('falls back to the database when cloudinary is requested but unusable', () => {
  // The checked-in .env is a copy of .env.example, so the variables are present
  // but hold "your-cloud-name". Honouring the request there would break uploads.
  const placeholders = {
    IMAGE_STORAGE: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_API_KEY: 'your-api-key',
    CLOUDINARY_API_SECRET: 'your-api-secret',
  };
  assert.strictEqual(storage.requestedProvider(placeholders), 'cloudinary');
  assert.strictEqual(storage.activeProvider(placeholders), 'mongodb', 'must not use unusable credentials');
});

test('uses cloudinary only when explicitly requested and genuinely configured', () => {
  const real = {
    IMAGE_STORAGE: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'fam-production',
    CLOUDINARY_API_KEY: '123456789012345',
    CLOUDINARY_API_SECRET: 'aB3-xYz_9secret',
  };
  assert.strictEqual(storage.activeProvider(real), 'cloudinary');
});

test('ignores an unknown IMAGE_STORAGE value rather than breaking uploads', () => {
  assert.strictEqual(storage.activeProvider({ IMAGE_STORAGE: 's3' }), 'mongodb');
  // A padded value is still recognised as a request, but with no credentials
  // behind it the safe choice is the database.
  assert.strictEqual(storage.requestedProvider({ IMAGE_STORAGE: '  CLOUDINARY  ' }), 'cloudinary');
  assert.strictEqual(storage.activeProvider({ IMAGE_STORAGE: '  CLOUDINARY  ' }), 'mongodb');
});

test('a partial set of cloudinary credentials is not treated as usable', () => {
  assert.strictEqual(
    storage.activeProvider({
      IMAGE_STORAGE: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'fam',
      CLOUDINARY_API_KEY: '123456789012345',
    }),
    'mongodb'
  );
});

test('status explains a cloudinary fallback instead of hiding it', () => {
  const s = storage.status({
    IMAGE_STORAGE: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_API_KEY: 'your-api-key',
    CLOUDINARY_API_SECRET: 'your-api-secret',
  });
  assert.strictEqual(s.provider, 'mongodb');
  assert.ok(s.detail, 'a fallback must be reported, not silent');
  assert.match(s.detail, /CLOUDINARY_CLOUD_NAME/);
  assert.strictEqual(s.detail.includes('IMAGE_STORAGE is set to cloudinary'), true);
});

test('status has no detail when the default provider is in use', () => {
  const s = storage.status({});
  assert.strictEqual(s.provider, 'mongodb');
  assert.strictEqual(s.detail, null, 'the normal case should show no warning at all');
});

/* ── buffer coercion ───────────────────────────────────────────────────── */

test('toNativeBuffer handles every shape Mongoose hands back', () => {
  const native = Buffer.from('image-bytes');
  assert.strictEqual(storage.toNativeBuffer(native), native);

  // BSON Binary, which is what .lean() and the raw driver return. This is the
  // case that silently produced a zero-length buffer before.
  const binary = { sub_type: 0, buffer: Buffer.from('from-binary'), position: 0 };
  const out = storage.toNativeBuffer(binary);
  assert.ok(Buffer.isBuffer(out), 'must return a native Buffer');
  assert.strictEqual(out.length, 11);
  assert.strictEqual(out.toString('utf8'), 'from-binary');

  assert.strictEqual(storage.toNativeBuffer(null), null);
  assert.strictEqual(storage.toNativeBuffer(undefined), null);
});

test('toNativeBuffer never returns an empty buffer for non-empty input', () => {
  // The failure mode this guards: Buffer.from(binary) is 0 bytes and no error.
  const binary = { buffer: Buffer.alloc(2048, 7), position: 0 };
  const out = storage.toNativeBuffer(binary);
  assert.strictEqual(out.length, 2048, 'must not silently truncate');
});

/* ── url shape ─────────────────────────────────────────────────────────── */

test('publicUrl is relative so it works on any host', () => {
  const id = '507f1f77bcf86cd799439011';
  assert.strictEqual(storage.publicUrl(id), '/api/v1/site-images/file/' + id);
});
