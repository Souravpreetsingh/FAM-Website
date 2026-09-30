/**
 * Reports what image storage this environment will actually use, and whether
 * an upload would work right now.
 *
 * Uploads default to MongoDB, so a missing or placeholder Cloudinary account is
 * no longer a problem. This script therefore reports the active provider first
 * and only treats Cloudinary as a problem when it was deliberately requested.
 */
require('dotenv').config();
const os = require('os');
const path = require('path');
const fs = require('fs');

const { cloudinaryStatus } = require('../config/cloudinaryStatus');
const imageStorage = require('../services/imageStorage');

const env = process.env;
const cloud = cloudinaryStatus(env);
const storage = imageStorage.status(env);

console.log('image storage in this environment:');
console.log('  requested :', imageStorage.requestedProvider(env));
console.log('  active    :', imageStorage.activeProvider(env));
console.log('  accepts   :', storage.accepts.join(', '));
console.log('  max size  :', Math.round(storage.maxBytes / (1024 * 1024)) + 'MB');

if (imageStorage.requestedProvider(env) === 'cloudinary') {
  console.log('\n  Cloudinary was requested, so its credentials decide:');
  console.log('    ready       :', cloud.ready);
  console.log('    missing     :', cloud.missing.length ? cloud.missing.join(', ') : '(none)');
  console.log('    placeholder :', cloud.placeholder.length ? cloud.placeholder.join(', ') : '(none)');
  if (cloud.ready) {
    console.log('\n  Cloudinary is live. Uploads will go there.');
    process.exit(0);
  }
  console.log('\n  These credentials are NOT usable, so uploads fall back to the');
  console.log('  database instead. The admin panel will show:');
  console.log('    "' + (storage.detail || '(no detail)') + '"');
  process.exit(0);
}

console.log('\n  No Cloudinary account is needed. Uploads are stored in MongoDB.');

if (storage.detail) {
  console.log('  Note: ' + storage.detail);
}
if (!storage.ready) {
  console.log('  Not connected to MongoDB right now, so uploads would fail.');
  console.log('  The app connects at boot; run this while the server is up to confirm.');
}
process.exit(0);
