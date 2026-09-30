/*
 * One-off: push the SiteImage registry into MongoDB so the admin Images view is
 * populated on an existing database.
 *
 * Idempotent and non-destructive: it only inserts missing slots and refreshes
 * the descriptive fields. Existing overrides (url / alt / isOverridden) are
 * preserved, so it is safe to run against a live database.
 *
 *   node scripts/seedSiteImages.js
 */
require('dotenv').config();

const connectDB = require('../config/db');
const siteImageService = require('../services/siteImageService');
const SiteImage = require('../models/SiteImage');
const { PAGES, ALL_IMAGES } = require('../config/siteImageRegistry');

const run = async () => {
  await connectDB();

  const result = await siteImageService.syncRegistry();
  const total = await SiteImage.countDocuments();
  const overridden = await SiteImage.countDocuments({ isOverridden: true });

  console.log('\nSite image registry seeded');
  console.log('  pages:     ' + PAGES.length);
  console.log('  slots:     ' + ALL_IMAGES.length);
  console.log('  written:   ' + total);
  console.log('  changed:   ' + result.upserted);
  console.log('  overrides: ' + overridden + '\n');

  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
