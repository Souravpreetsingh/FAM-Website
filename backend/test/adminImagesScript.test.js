/**
 * Static checks on public/admin/js/images.js.
 *
 * The bug this guards: picking an image from the library used to call
 * applyOverride() and close the modal without awaiting it. A rejected save
 * therefore produced no error at all -- the modal closed, the page refreshed
 * unchanged, and the owner was left believing the image had been replaced.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'public', 'admin', 'js', 'images.js');
const src = fs.readFileSync(SRC, 'utf8');

/** Returns the body of the named top-level function. */
function fn(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start !== -1, name + ' not found');
  let depth = 0;
  let i = src.indexOf('{', start);
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error('unbalanced braces in ' + name);
}

test('applyOverride returns its promise so callers can react to failure', () => {
  const body = fn('applyOverride');
  assert.ok(
    /return\s+api\(\)\.put/.test(body),
    'applyOverride must return the api() promise; otherwise no caller can catch a failed save'
  );
});

test('picking from the library handles a rejected save', () => {
  const body = fn('openPicker');
  assert.ok(
    /applyOverride\([^)]*\)[\s\S]*?\.then\(/.test(body),
    'the library pick must await applyOverride before closing the modal'
  );
  assert.ok(
    /\.catch\(/.test(body),
    'the library pick must catch a failed save and show it, not close silently'
  );
  // The modal may only close on success. A closeModal() that runs before the
  // promise settles is the bug itself.
  const closeAt = body.indexOf('closeModal()');
  const thenAt = body.indexOf('.then(');
  assert.ok(thenAt !== -1 && closeAt > thenAt, 'closeModal must come after the .then(), not before it');
});

test('a failed library pick leaves the picker usable so it can be retried', () => {
  const body = fn('openPicker');
  assert.ok(
    /pointerEvents\s*=\s*''/.test(body),
    'the chosen tile must be re-enabled after a failure, otherwise the picker is stuck'
  );
});

test('the upload path closes only on success and reports failure', () => {
  const body = fn('openEditor');
  // The chain must be then(close).catch(report): a rejected save skips the
  // close, so the editor stays open with the error visible.
  assert.ok(
    /\.then\(function \(\) \{\s*window\.AdminUI\.closeModal\(\);\s*\}\)\.catch\(/.test(body),
    'expected .then(closeModal).catch(...) in the upload chain'
  );
  assert.ok(/\.catch\(function \(err\)\{ window\.AdminUI\.toast\(err\.message,true\); \}\)/.test(body),
    'the upload path must show the error message');
});

test('reverting reports failures instead of looking successful', () => {
  assert.ok(
    /\.catch\(function \(e\)\{ window\.AdminUI\.toast\(e\.message,true\); \}\)/.test(src),
    'the revert handler must surface errors'
  );
});

test('the Cloudinary notice is driven by the service status object', () => {
  const body = fn('cloudinaryNotice');
  assert.ok(/if \(!c \|\| c\.ready\) return '';/.test(body), 'a ready service must show no notice');
  assert.ok(/c\.missing \|\| \[\]/.test(body), 'must read the missing list');
  assert.ok(/c\.placeholder \|\| \[\]/.test(body), 'must read the placeholder list');
});

test('the notice distinguishes unset from placeholder, in singular and plural', () => {
  const body = fn('cloudinaryNotice');
  for (const phrase of ['is not set', 'are not set', 'still holds', 'still hold']) {
    assert.ok(body.includes(phrase), 'missing phrase: ' + phrase);
  }
});

test('a list failure still renders a visible error in the view', () => {
  const body = fn('loadView');
  assert.ok(/\.catch\(/.test(body));
  assert.ok(/error-card/.test(body), 'a failed load must leave readable text, not a blank panel');
});

test('the notice uses the styled panel, not bare text', () => {
  assert.ok(src.includes('notice-card'), 'the Cloudinary notice should use .notice-card');
  const css = fs.readFileSync(
    path.join(__dirname, '..', '..', 'public', 'admin', 'css', 'admin.css'),
    'utf8'
  );
  assert.ok(/\.notice-card\s*\{/.test(css), '.notice-card must be defined in admin.css');
  assert.ok(/var\(--warn\)/.test(css), '.notice-card should reuse the existing --warn token');
});
