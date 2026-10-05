const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const keys = require(path.join(__dirname, '..', 'config', 'siteImageRegistry.js')).ALL_IMAGES.map((i) => i.key);

const read = (rel) => {
  const p = path.join(PUB, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
};

const htmlFiles = [path.join(PUB, 'index.html'), path.join(PUB, '404.html')].concat(
  // pages/ also holds subdirectories (e.g. blog/ with the generated Journal
  // articles), so filter to files only or readFileSync throws EISDIR.
  fs.readdirSync(path.join(PUB, 'pages'), { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(PUB, 'pages', e.name))
);

// Every JS file that can emit a data-fam-* attribute at runtime.
const jsFiles = [];
const walkJs = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git/.test(full)) walkJs(full); continue; }
    if (e.name.endsWith('.js')) jsFiles.push(full);
  }
};
walkJs(path.join(PUB, 'js'));
const jsAll = jsFiles.map((f) => ({ file: path.relative(PUB, f), src: fs.readFileSync(f, 'utf8') }));

// ---------------------------------------------------------------------------
// 1. Keys tagged in static markup.
// ---------------------------------------------------------------------------
const found = new Map();
const re = /data-fam-(?:img|bg|meta)="([^"]+)"/g;
// Inline scripts build attributes by concatenation, e.g.
//   data-fam-img="' + room.famKey + '"
// so the "key" the regex sees is a JavaScript fragment, not a registry key.
// A real key is always lowercase dotted words.
const REAL_KEY = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
for (const f of htmlFiles) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s)) !== null) {
    if (!REAL_KEY.test(m[1])) continue;
    if (!found.has(m[1])) found.set(m[1], path.relative(PUB, f));
  }
}

// ---------------------------------------------------------------------------
// 2. Keys resolved at runtime, each backed by *evidence in the source*.
//
// This used to be a hand-maintained allowlist, which is how three keys
// (concierge.attraction, booking.hero.poster, auth.hero) could be declared
// "handled by JS" while nothing actually referenced them. Every entry now has
// to point at the file that makes it work, and the script exits non-zero if a
// key cannot be proven reachable.
// ---------------------------------------------------------------------------
const evidence = new Map(); // key -> { rule, file }

const jsHas = (needle) => jsAll.find((f) => f.src.includes(needle));
const htmlHas = (needle) => htmlFiles.filter((fs2) => fs2 && fs.existsSync(fs2)).find((f) => fs.readFileSync(f, 'utf8').includes(needle));

const exploreData = read('js/explore-data.js');
const roomData = read('js/room-data.js');
// Both slideshows use the same `photos[0].famKey` idiom, so match on the
// surrounding markup instead to tell them apart in the report.
const exploreSlide = jsAll.find((f) => /famKey/.test(f.src) && /p\.famKey/.test(f.src) && /explore|EXPLORE/i.test(f.src));
const roomSlide = jsAll.find((f) => /famKey/.test(f.src) && /p\.famKey/.test(f.src) && /room|ROOM/i.test(f.src));
const bookingHtml = fs.readFileSync(path.join(PUB, 'pages', 'booking.html'), 'utf8');

const proof = (k) => {
  // explore.<destination>.<n>  -> explore-data.js defines <destination>, the
  // slideshow renders photos[i].famKey.
  let m = /^explore\.([a-z0-9-]+)\.\d+$/.exec(k);
  if (m) {
    const dest = m[1];
    if (exploreData.includes("'" + dest + "'") && exploreSlide) {
      return { rule: 'explore-data.js + ' + exploreSlide.file, file: 'js/explore-data.js' };
    }
    return null;
  }
  // rooms.<id>.<n> -> room-data.js defines <id>, the slideshow renders famKey.
  m = /^rooms\.([a-z0-9-]+)\.\d+$/.exec(k);
  if (m) {
    const id = m[1];
    if (roomData.includes("'" + id + "'") && roomSlide) {
      return { rule: 'room-data.js + ' + roomSlide.file, file: 'js/room-data.js' };
    }
    return null;
  }
  // rooms.<id>.cover -> booking.html builds the key at runtime.
  m = /^rooms\.([a-z0-9-]+)\.cover$/.exec(k);
  if (m) {
    if (bookingHtml.includes("'rooms.' + room.id + '.cover'")) {
      return { rule: 'pages/booking.html builds room.famKey', file: 'pages/booking.html' };
    }
    return null;
  }
  // Anything else must be referenced literally by name in a JS file, and that
  // reference must live alongside a data-fam-* attribute so the loader picks
  // it up. site-images.js is the loader itself, so its own doc comment (which
  // shows example keys) does not count as a binding.
  for (const f of jsAll) {
    if (f.file.endsWith('site-images.js')) continue;
    if (!f.src.includes("'" + k + "'") && !f.src.includes('"' + k + '"')) continue;
    if (!/data-fam-(?:img|bg|meta)/.test(f.src)) continue;
    return { rule: 'literal reference in ' + f.file, file: f.file };
  }
  return null;
};

const unproven = [];
const jsDriven = [];
for (const k of keys) {
  if (found.has(k)) continue;
  const p = proof(k);
  if (p) { jsDriven.push(k); evidence.set(k, p); } else unproven.push(k);
}

const unknown = [...found.keys()].filter((k) => !keys.includes(k));

// ---------------------------------------------------------------------------
// 3. Report
// ---------------------------------------------------------------------------
console.log('registry slots:             ' + keys.length);
console.log('tagged in static HTML:     ' + keys.filter((k) => found.has(k)).length);
console.log('proven reachable from JS:  ' + jsDriven.length);
console.log('');

console.log('HTML keys not in registry (should be none):');
console.log(unknown.length ? '   ' + unknown.join(', ') : '   none');
console.log('');

console.log('registry keys with no working binding (should be none):');
if (unproven.length) {
  for (const k of unproven) console.log('   UNBOUND ' + k);
} else {
  console.log('   none');
}

if (process.argv.includes('--why')) {
  console.log('\nhow each JS-driven key is reached:');
  const byRule = new Map();
  for (const [k, v] of evidence) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule).push(k);
  }
  for (const [rule, ks] of byRule) {
    console.log('  via ' + rule + ' (' + ks.length + ')');
    console.log('      ' + (ks.length <= 4 ? ks.join(', ') : ks[0] + ' ... ' + ks[ks.length - 1]));
  }
}

if (unknown.length || unproven.length) process.exit(1);
