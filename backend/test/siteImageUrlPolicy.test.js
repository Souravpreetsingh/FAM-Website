/**
 * Guard on which image addresses the admin API will accept.
 *
 * The override URL is written straight into the public override map, which the
 * site then puts into an <img src>. Accepting arbitrary strings would let a
 * compromised or careless admin session point the site at something other than
 * an image. The original check required https://, which is right, but it also
 * blocked the database-backed path this feature now uses by default, so the
 * rule had to widen. These tests pin exactly how far it widened.
 */
const { test } = require('node:test');
const assert = require('node:assert');

const { isAcceptableImageUrl } = require('../services/siteImageService');

test('accepts the database-backed storage path', () => {
  assert.strictEqual(isAcceptableImageUrl('/api/v1/site-images/file/507f1f77bcf86cd799439011'), true);
  assert.strictEqual(isAcceptableImageUrl('/api/v1/site-images/file/507F1F77BCF86CD799439011'), true);
});

test('accepts https addresses, for a CDN or the existing site', () => {
  assert.strictEqual(isAcceptableImageUrl('https://res.cloudinary.com/demo/a.jpg'), true);
  assert.strictEqual(isAcceptableImageUrl('HTTPS://example.test/a.jpg'), true);
});

test('rejects anything that is not an image address', () => {
  const bad = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:text/html,<script>alert(1)</script>',
    '//evil.test/a.jpg',
    'http://example.test/a.jpg',
    '/images/relative-but-not-ours.jpg',
    '/api/v1/site-images/file/../../etc/passwd',
    '/api/v1/site-images/file/not-an-id',
    '/api/v1/site-images/file/507f1f77bcf86cd799439011/extra',
    '/api/v2/site-images/file/507f1f77bcf86cd799439011',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    ' https://example.test/a.jpg extra',
  ];
  for (const url of bad) {
    assert.strictEqual(isAcceptableImageUrl(url), false, 'should have rejected: ' + url);
  }
});
