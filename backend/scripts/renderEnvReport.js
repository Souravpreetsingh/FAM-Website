/**
 * Reads the Render key from a file outside the repo (never a committed path)
 * and reports which fam service is live plus what it has configured.
 *
 * Prints variable NAMES and whether each looks usable. Never prints a value.
 */
const fs = require('fs');

const KEY = fs.readFileSync(process.argv[2], 'utf8').trim();
const API = 'https://api.render.com/v1';
const LIVE = 'flamingoaurmaina.com';

async function call(path) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + KEY, Accept: 'application/json' } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const looksLikePlaceholder = (v) =>
  !v || /^your[-_]/i.test(v) || /^(changeme|replace|placeholder|todo|example)$/i.test(v) || /^x+$/i.test(v);

const CLOUD = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

(async () => {
  const services = await call('/services?limit=100');
  const web = (services.json || []).filter((s) => s.service && s.service.type === 'web_service');
  const fam = web.filter((s) => /^fam-website/.test(s.service.name));

  console.log('web services: ' + web.length + ', matching /fam-website/: ' + fam.length + '\n');

  // Which service actually answers the live hostname?
  let liveId = null;
  for (const s of fam) {
    const d = (await call('/services/' + s.service.id)).json;
    const det = (d && d.serviceDetails) || {};
    const urls = []
      .concat(det.envSpecificDetails && det.envSpecificDetails.url ? [det.envSpecificDetails.url] : [])
      .concat(detailUrls(d));
    const owns = urls.some((u) => String(u).includes(LIVE));
    console.log('  ' + s.service.name.padEnd(16) + s.service.id + '  ' + (urls[0] || '(no url)'));
    if (owns) liveId = s.service.id;
  }

  if (!liveId) {
    console.log('\nCould not match the live hostname ' + LIVE + ' to a service.');
    process.exit(2);
  }

  const name = fam.find((s) => s.service.id === liveId).service.name;
  console.log('\nLIVE SERVICE: ' + name + ' (' + liveId + ')\n');

  const env = await call('/services/' + liveId + '/env-vars?limit=200');
  if (env.status !== 200) {
    console.log('could not read env vars: HTTP ' + env.status);
    console.log(env.text.slice(0, 300));
    process.exit(1);
  }

  const byName = {};
  for (const v of env.json || []) byName[(v.envVar || {}).key] = (v.envVar || {}).value;
  console.log('env vars set: ' + (env.json || []).length + '\n');

  console.log('Cloudinary:');
  let allGood = true;
  for (const k of CLOUD) {
    const v = byName[k];
    const state = v === undefined ? 'NOT SET' : looksLikePlaceholder(v) ? 'PLACEHOLDER (unusable)' : 'looks real';
    if (state !== 'looks real') allGood = false;
    console.log('  ' + k.padEnd(24) + state);
  }

  console.log('\nContext:');
  for (const k of ['NODE_ENV', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'JWT_ACCESS_SECRET', 'MONGODB_URI', 'FRONTEND_URL', 'APP_URL']) {
    const v = byName[k];
    const state = v === undefined ? 'NOT SET' : looksLikePlaceholder(v) ? 'PLACEHOLDER' : 'set';
    console.log('  ' + k.padEnd(24) + state);
  }

  console.log('\n' + (allGood
    ? 'RESULT: Cloudinary is fully configured on the live service.'
    : 'RESULT: Cloudinary is NOT usable on the live service. Upload and library will not work.') + '\n');
  process.exit(0);
})().catch((e) => { console.error('error:', e.message); process.exit(1); });

function detailUrls(d) {
  const out = [];
  for (const v of d && Array.isArray(d.serviceDetails) ? d.serviceDetails : []) out.push(v.url);
  return out.filter(Boolean);
}
