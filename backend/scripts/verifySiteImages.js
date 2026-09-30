/*
 * Round-trip check for the site image override flow against the real database.
 * Applies an override, confirms the public map reports it, then reverts and
 * confirms the slot is clean again. Leaves no trace.
 *
 *   node scripts/verifySiteImages.js
 */
require('dotenv').config();

const connectDB = require('../config/db');
const siteImageService = require('../services/siteImageService');
const SiteImage = require('../models/SiteImage');
const { PAGES, ALL_IMAGES } = require('../config/siteImageRegistry');

const KEY = 'home.story';
const TEST_URL = 'https://res.cloudinary.com/fam-verify-test/image/upload/v1/override-probe.jpg';

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label + '  (got: ' + actual + ')');
}

const run = async () => {
  await connectDB();

  console.log('\nRegistry');
  check('pages registered', PAGES.length, 10);
  check('slots registered', ALL_IMAGES.length, 132);
  check('no duplicate keys', new Set(ALL_IMAGES.map((i) => i.key)).size, ALL_IMAGES.length);

  console.log('\nSeed state');
  check('slots in database', await SiteImage.countDocuments(), ALL_IMAGES.length);
  check('no overrides yet', await SiteImage.countDocuments({ isOverridden: true }), 0);

  console.log('\nOverride round-trip on "' + KEY + '"');
  const admin = { _id: null, email: 'verify@script.local' };
  const set = await siteImageService.setOverride(
    KEY,
    { url: TEST_URL, publicId: 'fam-verify-test/override-probe', alt: 'Probe alt' },
    admin
  );
  check('isOverridden', set.isOverridden, true);
  check('url applied', set.url, TEST_URL);
  check('alt applied', set.alt, 'Probe alt');

  const map = await siteImageService.getOverrideMap();
  check('map reports the url', map.urls[KEY], TEST_URL);
  check('map reports the alt', map.alts[KEY], 'Probe alt');
  check('map size is exactly 1', Object.keys(map.urls).length, 1);

  console.log('\nValidation');
  let rejectedHttp = false;
  try {
    await siteImageService.setOverride(KEY, { url: 'javascript:alert(1)' }, admin);
  } catch (e) {
    rejectedHttp = e.statusCode === 400;
  }
  check('non-https url rejected', rejectedHttp, true);

  let unknownRejected = false;
  try {
    await siteImageService.setOverride('not.a.real.key', { url: TEST_URL }, admin);
  } catch (e) {
    unknownRejected = e.statusCode === 400;
  }
  check('unknown key rejected', unknownRejected, true);

  console.log('\nRevert');
  const reverted = await siteImageService.revert(KEY);
  check('isOverridden cleared', reverted.isOverridden, false);
  check('url cleared', reverted.url, '');
  const map2 = await siteImageService.getOverrideMap();
  check('map is empty again', Object.keys(map2.urls).length, 0);
  check('fallback preserved', reverted.fallback, '/images/fam-big-pic.jpg');

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + '\n');
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((err) => {
  console.error('Verification error:', err.message);
  process.exit(1);
});
