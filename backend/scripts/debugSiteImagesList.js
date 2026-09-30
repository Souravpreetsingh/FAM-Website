/*
 * Reproduces the admin Images list failure against the real database.
 *
 *   node scripts/debugSiteImagesList.js
 */
require('dotenv').config();

const connectDB = require('../config/db');
const siteImageService = require('../services/siteImageService');
const SiteImage = require('../models/SiteImage');
const ApiResponse = require('../utils/ApiResponse');

const run = async () => {
  await connectDB();

  console.log('\n--- raw service call ---');
  try {
    const data = await siteImageService.listImages();
    console.log('OK  pages=' + data.pages.length + ' images=' + data.images.length);
    console.log('first image:', JSON.stringify(data.images[0], null, 2));
  } catch (err) {
    console.log('THREW ' + err.name + ': ' + err.message);
    console.log(err.stack.split('\n').slice(0, 8).join('\n'));
  }

  console.log('\n--- documents actually in the collection ---');
  const count = await SiteImage.countDocuments();
  console.log('count: ' + count);
  const sample = await SiteImage.findOne({});
  console.log('sample doc keys: ' + (sample ? Object.keys(sample.toObject()).join(', ') : 'NONE'));
  if (sample) {
    console.log('sample: ' + JSON.stringify(sample.toObject(), null, 2).slice(0, 700));
  }

  console.log('\n--- ApiResponse serialisation ---');
  try {
    const data = await siteImageService.listImages();
    const payload = new ApiResponse.success(data, 'Site images loaded');
    const json = JSON.stringify(payload);
    console.log('payload length: ' + json.length);
  } catch (err) {
    console.log('SERIALISE THREW ' + err.name + ': ' + err.message);
    console.log(err.stack.split('\n').slice(0, 8).join('\n'));
  }

  process.exit(0);
};

run().catch((err) => {
  console.error('debug error:', err.message);
  process.exit(1);
});
