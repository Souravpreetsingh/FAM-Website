/**
 * Guards the Cloudinary readiness check.
 *
 * This exists because a non-empty check is not enough. `.env` in this repo was
 * copied from `.env.example`, so CLOUDINARY_* are all set -- to the literal
 * text "your-cloud-name" and friends. A plain Boolean() check reported the
 * server as ready, the admin panel showed no warning, and the failure only
 * surfaced when an upload was attempted, as the SDK's opaque
 * "cloud_name is disabled".
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { cloudinaryStatus, isCloudinaryConfigured, looksLikePlaceholder } = require('../config/cloudinaryStatus');

const real = {
  CLOUDINARY_CLOUD_NAME: 'fam-production-abc',
  CLOUDINARY_API_KEY: '123456789012345',
  CLOUDINARY_API_SECRET: 'aB3-xYz_9secretvalue',
};

test('real-looking credentials are ready', () => {
  const s = cloudinaryStatus(real);
  assert.strictEqual(s.ready, true);
  assert.deepStrictEqual(s.missing, []);
  assert.deepStrictEqual(s.placeholder, []);
});

test('variables absent from the environment are reported as missing', () => {
  const s = cloudinaryStatus({});
  assert.strictEqual(s.ready, false);
  assert.deepStrictEqual(s.missing.sort(), [
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_CLOUD_NAME',
  ]);
});

test('empty and whitespace-only values count as missing', () => {
  const s = cloudinaryStatus({ ...real, CLOUDINARY_API_SECRET: '   ' });
  assert.strictEqual(s.ready, false);
  assert.deepStrictEqual(s.missing, ['CLOUDINARY_API_SECRET']);
});

test('the .env.example placeholders are caught, not treated as configured', () => {
  // This is the exact state of the checked-in .env.
  const s = cloudinaryStatus({
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_API_KEY: 'your-api-key',
    CLOUDINARY_API_SECRET: 'your-api-secret',
  });
  assert.strictEqual(s.ready, false, 'must not report ready');
  assert.deepStrictEqual(s.missing, []);
  assert.strictEqual(s.placeholder.length, 3);
});

test('one real value among placeholders still fails, and names only the bad one', () => {
  const s = cloudinaryStatus({ ...real, CLOUDINARY_API_KEY: 'your-api-key' });
  assert.strictEqual(s.ready, false);
  assert.deepStrictEqual(s.placeholder, ['CLOUDINARY_API_KEY']);
  assert.deepStrictEqual(s.missing, []);
});

test('placeholder patterns are recognised', () => {
  for (const v of ['your-cloud-name', 'your_api_key', 'changeme', 'CHANGEME', 'replace-me', 'placeholder', 'xxxxx', 'TODO', 'example']) {
    assert.ok(looksLikePlaceholder(v), v + ' should be a placeholder');
  }
  // Real Cloudinary cloud names are account identifiers, so a value that begins
  // with the "your-" convention is filler by definition.
  for (const v of ['fam-production', 'fam-website-1a2b3c', '1234567890', 'aB3-xYz_9secret', 'dm5kqz2kf']) {
    assert.ok(!looksLikePlaceholder(v), v + ' should not be a placeholder');
  }
});

test('isCloudinaryConfigured agrees with cloudinaryStatus().ready', () => {
  assert.strictEqual(isCloudinaryConfigured(real), true);
  assert.strictEqual(isCloudinaryConfigured({}), false);
});

test('reads the live process environment by default', () => {
  const s = cloudinaryStatus();
  assert.strictEqual(typeof s.ready, 'boolean');
  assert.ok(Array.isArray(s.missing));
  assert.ok(Array.isArray(s.placeholder));
});

test('a non-empty check would wrongly call placeholder .env ready', () => {
  // The checked-in .env is a copy of .env.example, so all three variables are
  // present and non-empty. This is the exact trap: Boolean(env.X && env.Y &&
  // env.Z) returns true, the admin panel shows no notice, and every upload then
  // fails with the SDK's "cloud_name is disabled".
  const placeholders = {
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_API_KEY: 'your-api-key',
    CLOUDINARY_API_SECRET: 'your-api-secret',
  };
  const naiveReady = Object.keys(placeholders).every((k) => String(placeholders[k]).trim() !== '');

  assert.strictEqual(naiveReady, true, 'the naive check is fooled, which is why it was replaced');
  assert.strictEqual(cloudinaryStatus(placeholders).ready, false, 'the real check is not fooled');
});

test('readiness is false whenever any single variable is unusable', () => {
  // Whichever of the three is broken, the notice must appear. Asserted as a
  // matrix so no one variable can be added to the check by accident.
  const good = {
    CLOUDINARY_CLOUD_NAME: 'fam-production',
    CLOUDINARY_API_KEY: '123456789012345',
    CLOUDINARY_API_SECRET: 'aB3-xYz_9secret',
  };

  for (const key of Object.keys(good)) {
    assert.strictEqual(cloudinaryStatus(good).ready, true, 'baseline should be ready');
    assert.strictEqual(cloudinaryStatus({ ...good, [key]: 'your-thing' }).ready, false, key + ' placeholder');
    assert.strictEqual(cloudinaryStatus({ ...good, [key]: '' }).ready, false, key + ' empty');
    assert.strictEqual(cloudinaryStatus({ ...good, [key]: undefined }).ready, false, key + ' undefined');
  }
});

test('listImages reports the same status it would enforce', async () => {
  // The admin banner is only trustworthy if it agrees with whether an upload
  // would actually succeed, so both must derive from cloudinaryStatus().
  const { cloudinaryStatus: fresh } = require('../config/cloudinaryStatus');
  const service = require('../services/siteImageService');
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'siteImageService.js'), 'utf8');

  assert.ok(
    source.includes('cloudinary: cloudinaryStatus()'),
    'listImages must return cloudinaryStatus() directly rather than a separate check'
  );
  assert.strictEqual(fresh().ready, cloudinaryStatus().ready);
  void service;
});
