/*
 * Browser-free test for the public override loader (public/js/site-images.js).
 * Exercises the real script against a stubbed fetch + minimal DOM so we know an
 * override actually reaches the right element, and that an empty override map
 * leaves every element untouched.
 *
 *   node scripts/testSiteImagesLoader.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'site-images.js'), 'utf8');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label + '  (got: ' + JSON.stringify(actual) + ')');
}

// Minimal element: only what the loader touches.
function el(tag, attrs) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: Object.assign({}, attrs || {}),
    style: {},
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this._attrs, n) ? this._attrs[n] : null; },
    setAttribute(n, v) { this._attrs[n] = v; },
  };
}

function makeEnv({ elementsBySelector, map }) {
  const sessionStorage = {};
  const win = {};
  const sandbox = {
    window: win,
    document: {
      readyState: 'complete',
      querySelectorAll: (sel) => (elementsBySelector[sel] || []),
      addEventListener: () => {},
    },
    sessionStorage: {
      getItem: (k) => (k in sessionStorage ? sessionStorage[k] : null),
      setItem: (k, v) => { sessionStorage[k] = v; },
      removeItem: (k) => { delete sessionStorage[k]; },
    },
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: map }) }),
    Promise,
    setTimeout,
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { sandbox, win };
}

async function run() {
  console.log('\n1. override map applied to every attribute type');
  {
    const img = el('img', { 'data-fam-img': 'home.story', src: '/images/fam-big-pic.jpg', alt: 'old alt' });
    const bg = el('div', { 'data-fam-bg': 'home.cta' });
    const meta = el('meta', { 'data-fam-meta': 'home.og', content: 'https://old/og.jpg' });
    const poster = el('video', { 'data-fam-img': 'home.hero.poster', 'data-fam-attr': 'poster', poster: '/images/hero/a.jpg' });
    const untouched = el('img', { 'data-fam-img': 'life.chapter.03', src: 'https://remote/x.jpg' });

    const { win } = makeEnv({
      map: { urls: { 'home.story': 'https://cdn/new-story.jpg', 'home.cta': 'https://cdn/new-cta.jpg', 'home.og': 'https://cdn/new-og.jpg', 'home.hero.poster': 'https://cdn/new-poster.jpg' }, alts: { 'home.story': 'new alt' } },
      elementsBySelector: {
        '[data-fam-img]': [img, poster, untouched],
        '[data-fam-bg]': [bg],
        '[data-fam-meta]': [meta],
      },
    });

    await win.FamImages.ready;
    check('img src swapped', img.getAttribute('src'), 'https://cdn/new-story.jpg');
    check('img alt swapped', img.getAttribute('alt'), 'new alt');
    check('bg applied', bg.style.backgroundImage, 'url("https://cdn/new-cta.jpg")');
    check('meta content swapped', meta.getAttribute('content'), 'https://cdn/new-og.jpg');
    check('video poster swapped', poster.getAttribute('poster'), 'https://cdn/new-poster.jpg');
    check('unrelated img untouched', untouched.getAttribute('src'), 'https://remote/x.jpg');
  }

  console.log('\n2. empty override map leaves the page exactly as authored');
  {
    const img = el('img', { 'data-fam-img': 'home.story', src: '/images/fam-big-pic.jpg' });
    const bg = el('div', { 'data-fam-bg': 'home.cta' });
    const { win } = makeEnv({
      map: { urls: {}, alts: {} },
      elementsBySelector: { '[data-fam-img]': [img], '[data-fam-bg]': [bg], '[data-fam-meta]': [] },
    });
    await win.FamImages.ready;
    check('img src unchanged', img.getAttribute('src'), '/images/fam-big-pic.jpg');
    check('no background set', bg.style.backgroundImage, undefined);
  }

  console.log('\n3. resolver helpers used by the JS-driven photos');
  {
    const img = el('img', { 'data-fam-img': 'rooms.flamingo-1.1', src: '/images/rooms/flamingo-1/01.jpg' });
    const { win } = makeEnv({
      map: { urls: { 'rooms.flamingo-1.1': 'https://cdn/f1-1.jpg' }, alts: { 'rooms.flamingo-1.1': 'Replaced frame' } },
      elementsBySelector: { '[data-fam-img]': [img], '[data-fam-bg]': [], '[data-fam-meta]': [] },
    });
    // Before the map resolves the resolver must still return the fallback.
    check('url() falls back pre-load', win.FamImages.url('rooms.flamingo-1.1', '/images/rooms/flamingo-1/01.jpg'), '/images/rooms/flamingo-1/01.jpg');
    await win.FamImages.ready;
    check('url() honours override', win.FamImages.url('rooms.flamingo-1.1', '/images/rooms/flamingo-1/01.jpg'), 'https://cdn/f1-1.jpg');
    check('alt() honours override', win.FamImages.alt('rooms.flamingo-1.1', 'original'), 'Replaced frame');
    check('url() unknown key returns fallback', win.FamImages.url('nope', 'fallback.jpg'), 'fallback.jpg');
    check('isOverridden true', win.FamImages.isOverridden('rooms.flamingo-1.1'), true);
    check('isOverridden false', win.FamImages.isOverridden('nope'), false);
  }

  console.log('\n4. endpoint unreachable keeps the authored page');
  {
    const img = el('img', { 'data-fam-img': 'home.story', src: '/images/fam-big-pic.jpg' });
    const { sandbox, win } = makeEnv({
      map: { urls: {}, alts: {} },
      elementsBySelector: { '[data-fam-img]': [img], '[data-fam-bg]': [], '[data-fam-meta]': [] },
    });
    sandbox.fetch = () => Promise.reject(new Error('offline'));
    const { win: w2 } = makeEnv({ map: { urls: {}, alts: {} }, elementsBySelector: { '[data-fam-img]': [img], '[data-fam-bg]': [], '[data-fam-meta]': [] } });
    w2.__unused = true;
    const { win: w3 } = (() => {
      const s = Object.assign({}, sandbox, { fetch: () => Promise.reject(new Error('offline')) });
      const winx = {};
      const sbx = {
        window: winx,
        document: { readyState: 'complete', querySelectorAll: (sel) => ({ '[data-fam-img]': [img], '[data-fam-bg]': [], '[data-fam-meta]': [] }[sel] || []), addEventListener: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        fetch: () => Promise.reject(new Error('offline')),
        Promise, setTimeout, console,
      };
      vm.createContext(sbx);
      vm.runInContext(SRC, sbx);
      return { win: winx };
    })();
    await w3.FamImages.ready;
    check('img survives fetch failure', img.getAttribute('src'), '/images/fam-big-pic.jpg');
    void win;
  }

  console.log('\n' + (failures === 0 ? 'ALL LOADER CHECKS PASSED' : failures + ' LOADER CHECK(S) FAILED') + '\n');
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
