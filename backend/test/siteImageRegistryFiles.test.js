/**
 * Guards the two failure modes that make the admin Images page useless while
 * looking fine in code:
 *
 *   1. A registry fallback that points at a file which does not exist. The
 *      public site would show a broken image and the admin preview a blank box.
 *   2. A fallback that the admin panel cannot resolve to a previewable URL.
 *      Fallbacks are written relative to the page that uses them ("images/x.jpg"
 *      on the home page, "../images/x.jpg" inside /pages) but the admin lives at
 *      /admin/, so they must be resolved against the site root first.
 *
 *   node --test test/siteImageRegistryFiles.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { ALL_IMAGES, PAGES } = require('../config/siteImageRegistry');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// Mirrors previewUrl() in public/admin/js/images.js.
function previewUrl(u) {
  if (!u) return '';
  if (/^(https?:|data:|\/)/i.test(u)) return u;
  return '/' + u.replace(/^(\.\.\/|\.\/)+/, '');
}

test('registry keys are unique and well formed', () => {
  const keys = ALL_IMAGES.map((i) => i.key);
  assert.strictEqual(new Set(keys).size, keys.length, 'no duplicate keys');
  for (const k of keys) {
    assert.match(k, /^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'key shape: ' + k);
  }
});

test('every image declares a page that exists in PAGES', () => {
  const ids = new Set(PAGES.map((p) => p.id));
  for (const img of ALL_IMAGES) {
    assert.ok(ids.has(img.page), img.key + ' -> unknown page ' + img.page);
  }
});

test('every <img> rendered from a registry key has alt text', () => {
  // The registry is not the only source of alt text: the explore and room
  // slideshows build their <img> tags from explore-data.js / room-data.js and
  // FamImages.alt() falls back to whatever is authored there. What must always
  // hold is that no <img> on the public site ships without an alt attribute, so
  // assert that against the markup itself.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      if (path.basename(full) === '404.html') continue; // template, not a page
      const html = fs.readFileSync(full, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      for (const m of html.matchAll(/<img\b[^>]*>/g)) {
        if (!/\balt\s*=/.test(m[0])) offenders.push(path.relative(PUBLIC_DIR, full) + ': ' + m[0].slice(0, 90));
      }
    }
  };
  walk(PUBLIC_DIR);
  assert.deepStrictEqual(offenders, [], '<img> tags missing an alt attribute');
});

test('every local fallback resolves to a file that exists on disk', () => {
  const missing = [];
  for (const img of ALL_IMAGES) {
    const url = previewUrl(img.fallback);
    if (!url || /^https?:/i.test(url)) continue; // external, checked separately
    const rel = url.replace(/^\//, '');
    if (!fs.existsSync(path.join(PUBLIC_DIR, rel))) missing.push(img.key + ' -> ' + url);
  }
  assert.deepStrictEqual(missing, [], 'registry fallbacks point at missing files');
});

test('every fallback is previewable by the admin panel', () => {
  // Slots with no image yet (the two Maina room covers) are legitimately empty.
  const empty = ALL_IMAGES.filter((i) => !i.fallback).map((i) => i.key);
  assert.deepStrictEqual(empty.sort(), ['rooms.maina-1.cover', 'rooms.maina-2.cover']);

  for (const img of ALL_IMAGES) {
    if (!img.fallback) continue;
    const u = previewUrl(img.fallback);
    assert.ok(u, 'previewUrl returned nothing for ' + img.key);
    assert.ok(/^(https?:\/\/|\/)/.test(u), 'not resolvable to root: ' + img.key + ' -> ' + u);
  }
});

test('external fallbacks are all https', () => {
  const insecure = ALL_IMAGES.filter((i) => /^http:\/\//i.test(i.fallback)).map((i) => i.key);
  assert.deepStrictEqual(insecure, [], 'no plain-http fallbacks');
});

test('Cloudinary delivery is permitted by the CSP in backend/app.js', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /imgSrc[\s\S]{0,400}?res\.cloudinary\.com/, 'imgSrc must allow res.cloudinary.com');
});
