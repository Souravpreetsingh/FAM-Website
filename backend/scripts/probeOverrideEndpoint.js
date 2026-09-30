/*
 * End-to-end HTTP check: applies an override directly in the database, then asks
 * the running server's public endpoint whether it reports it. Confirms the whole
 * chain (MongoDB -> service -> route -> JSON) rather than just the service.
 *
 *   node scripts/probeOverrideEndpoint.js [baseUrl]
 */
require('dotenv').config();

const connectDB = require('../config/db');
const siteImageService = require('../services/siteImageService');
const SiteImage = require('../models/SiteImage');

const BASE = process.argv[2] || 'http://localhost:5098';
const KEY = 'life.chapter.01';
const PROBE = 'https://res.cloudinary.com/fam-probe/image/upload/v1/probe.jpg';

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label + '  (got: ' + actual + ')');
}

const run = async () => {
  await connectDB();

  console.log('\nBefore override');
  const before = await fetch(BASE + '/api/v1/site-images');
  const bodyBefore = await before.json();
  check('endpoint reachable', before.ok, true);
  check('override absent', bodyBefore.data.urls[KEY], undefined);

  console.log('\nApply override in MongoDB');
  await siteImageService.setOverride(KEY, { url: PROBE, alt: 'Probe alt' }, { _id: null, email: 'probe@test' });

  const after = await fetch(BASE + '/api/v1/site-images');
  const bodyAfter = await after.json();
  check('endpoint still reachable', after.ok, true);
  check('url served to the public', bodyAfter.data.urls[KEY], PROBE);
  check('alt served to the public', bodyAfter.data.alts[KEY], 'Probe alt');
  check('cache header present', /max-age/.test(after.headers.get('cache-control') || ''), true);

  console.log('\nCleanup');
  await siteImageService.revert(KEY);
  const final = await fetch(BASE + '/api/v1/site-images');
  const bodyFinal = await final.json();
  check('override cleared', bodyFinal.data.urls[KEY], undefined);
  check('no leftovers in db', await SiteImage.countDocuments({ isOverridden: true }), 0);

  console.log('\n' + (failures === 0 ? 'END-TO-END PASSED' : failures + ' CHECK(S) FAILED') + '\n');
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((err) => {
  console.error('Probe error:', err.message);
  process.exit(1);
});
