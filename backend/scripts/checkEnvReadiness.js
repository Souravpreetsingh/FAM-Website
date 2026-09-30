require('dotenv').config();
const { cloudinaryStatus } = require('../config/cloudinaryStatus');
const svc = require('../services/cloudinaryService');
const os = require('os');
const path = require('path');
const fs = require('fs');

const s = cloudinaryStatus();
console.log('readiness of this .env:');
console.log('  ready       :', s.ready);
console.log('  missing     :', s.missing.length ? s.missing.join(', ') : '(none)');
console.log('  placeholder :', s.placeholder.length ? s.placeholder.join(', ') : '(none)');

const tmp = path.join(os.tmpdir(), 'fam-notready.png');
fs.writeFileSync(tmp, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
));

svc.uploadSiteImage(tmp)
  .then(() => {
    console.log('\n  upload: SUCCEEDED (credentials are live)');
    fs.unlinkSync(tmp);
    process.exit(0);
  })
  .catch((e) => {
    console.log('\n  upload blocked, message the admin would see:');
    console.log('    "' + e.message + '"');
    fs.unlinkSync(tmp);
    process.exit(0);
  });
