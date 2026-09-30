const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'public');
const keys = require(path.join(__dirname, '..', 'config', 'siteImageRegistry.js')).ALL_IMAGES.map((i) => i.key);

const htmlFiles = [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, '404.html'),
].concat(
  fs.readdirSync(path.join(ROOT, 'pages')).map((f) => path.join(ROOT, 'pages', f))
);

// booking.html builds its room cards in JavaScript and concatenates
// data-fam-img="' + room.famKey + '", so those keys never appear literally.
const JS_CONCATENATED = /^\s*'\s*\+\s*room\.famKey\s*\+\s*'\s*$/;

const found = new Map();
const re = /data-fam-(?:img|bg|meta)="([^"]+)"/g;
for (const f of htmlFiles) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s)) !== null) {
    if (!found.has(m[1])) found.set(m[1], path.relative(ROOT, f));
  }
}

// Keys resolved at runtime by JS rather than tagged in markup.
// Keys that never appear as a data-fam-* attribute in static HTML because they
// are produced by JavaScript at runtime instead.
const isJsDriven = (k) =>
  /^explore\.[a-z0-9-]+\.\d+$/.test(k) || // explore slideshow photos
  /^rooms\.[a-z0-9-]+\.\d+$/.test(k) ||   // room slideshow photos
  /^rooms\.[a-z0-9-]+\.cover$/.test(k) || // booking card covers (JS string concat)
  k === 'concierge.attraction' ||         // built in concierge.js
  k === 'booking.hero.poster' ||          // rendered by hero-video.js
  k === 'auth.hero';                      // login.html / signup.html

const unknown = [...found.keys()].filter((k) => !keys.includes(k));
const staticKeys = keys.filter((k) => found.has(k));
const untagged = keys.filter((k) => !found.has(k) && !isJsDriven(k));

console.log('registry slots:            ' + keys.length);
console.log('tagged in static HTML:    ' + staticKeys.length);
console.log('resolved via JS at runtime: ' + keys.filter(isJsDriven).length);
console.log('');
const realUnknown = unknown.filter((k) => !JS_CONCATENATED.test(k));
console.log('HTML keys not in registry (should be none): ' + (realUnknown.length ? realUnknown.join(', ') : 'none'));
console.log('');
console.log('registry keys neither tagged nor JS-driven (should be none):');
console.log(untagged.length ? untagged.map((k) => '   MISSING ' + k).join('\n') : '   none');
