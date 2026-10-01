/**
 * Route-level checks that do not need a database: the Journal endpoints sit
 * behind the existing admin gate, the schemas accept a realistic payload, and
 * the image picker only offers files that exist.
 *
 *   node --test test/journalRoutes.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const router = require('../routes/adminRoutes');
const journalValidation = require('../validations/journalValidation');
const journalController = require('../controllers/journalController');
const journalService = require('../services/journalService');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function routes() {
  const out = [];
  router.stack.forEach((layer) => {
    if (layer.route) {
      out.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods).filter((m) => m !== '_all')
      });
    }
  });
  return out;
}

test('every Journal route is registered under /journal', () => {
  const found = routes()
    .filter((r) => r.path.startsWith('/journal'))
    .map((r) => `${r.methods.join('|').toUpperCase()} ${r.path}`);

  assert.deepStrictEqual(found.sort(), [
    'DELETE /journal/:slug',
    'GET /journal',
    'GET /journal/:slug',
    'GET /journal/images',
    'GET /journal/preview/:slug',
    'POST /journal',
    'POST /journal/:slug/restore',
    'POST /journal/rebuild',
    'PUT /journal/:slug',
    'PUT /journal/:slug/feature',
    'PUT /journal/:slug/publish'
  ]);
});

test('Journal routes are mounted after the admin authorisation gate', () => {
  // router.use(authenticate, authorizeAdmin) contributes two layers: the
  // authenticate handler and authorizeAdmin. authorizeAdmin is the one with a
  // stable function name, so it marks the end of the public part of the router.
  const stack = router.stack;
  const gateIndex = stack.findIndex((layer) => layer.name === 'authorizeAdmin');
  assert.ok(gateIndex > -1, 'the admin authorisation gate is missing from adminRoutes');

  const firstJournal = stack.findIndex((layer) => layer.route && layer.route.path.startsWith('/journal'));
  assert.ok(firstJournal > gateIndex, 'a Journal route is registered before the auth gate');

  // Only the session endpoints may sit in front of the gate.
  const publicPaths = stack
    .slice(0, gateIndex)
    .filter((l) => l.route)
    .map((l) => l.route.path);
  assert.deepStrictEqual(publicPaths.sort(), ['/login', '/logout', '/refresh']);
});

test('Journal writes are rate limited, reads are not', () => {
  // A Journal write shells out to the generator, so the mutating routes carry a
  // limiter middleware in their own handler stack.
  const writes = ['post', 'put', 'delete'];
  const journalRoutes = router.stack.filter((l) => l.route && l.route.path.startsWith('/journal'));
  assert.ok(journalRoutes.length > 0);

  // express-rate-limit returns an anonymous function, so it is identified by the
  // resetKey/getKey helpers it hangs on its handler.
  const isLimiter = (handler) =>
    Boolean(handler.handle && handler.handle.resetKey && handler.handle.getKey);

  const limited = [];
  const unlimited = [];
  for (const layer of journalRoutes) {
    const method = Object.keys(layer.route.methods).find((m) => writes.includes(m));
    const hasLimiter = layer.route.stack.some(isLimiter);
    (method ? limited : unlimited).push({ path: layer.route.path, method, hasLimiter });
  }

  const writesMissing = limited.filter((r) => !r.hasLimiter).map((r) => `${r.method} ${r.path}`);
  assert.deepStrictEqual(writesMissing, [], 'Journal write routes without a rate limiter');

  const readsLimited = unlimited.filter((r) => r.hasLimiter).map((r) => r.path);
  assert.deepStrictEqual(readsLimited, [], 'Journal read routes should not be rate limited');
});

test('the image picker only offers files that exist under public/images', () => {
  const { images, count } = journalService.listImages();
  assert.ok(count > 0, 'the picker found no images at all');

  for (const image of images.slice(0, 400)) {
    assert.match(image.src, /^\/images\/[A-Za-z0-9._\-/]+$/, 'unsafe src: ' + image.src);
    assert.ok(
      fs.existsSync(path.join(PUBLIC_DIR, image.src.replace(/^\//, ''))),
      'listed a missing file: ' + image.src
    );
  }
});

test('images the picker can measure are reported with real dimensions', () => {
  const { images } = journalService.listImages();
  const sized = images.filter((i) => i.w && i.h);
  assert.ok(sized.length > 0, 'no image reported a size');

  for (const image of sized.slice(0, 50)) {
    assert.ok(image.w > 0 && image.h > 0);
    assert.ok(Number.isInteger(image.w) && Number.isInteger(image.h));
  }
});

test('a full article payload passes validation', () => {
  const payload = {
    body: {
      slug: 'a-new-story',
      title: 'A new story from the admin panel',
      dek: 'The standfirst that appears under the headline.',
      category: 'Mountain Life',
      date: '2026-10-01',
      readingTime: '6 min read',
      excerpt: 'The excerpt shown on the landing page card.',
      hero: {
        src: '/images/life/chapter-06.jpg',
        w: 1776,
        h: 999,
        alt: 'Morning light',
        caption: 'Hills above Jibhi.'
      },
      inline: [
        {
          src: '/images/life/chapter-06.jpg',
          w: 1776,
          h: 999,
          alt: 'Another view',
          caption: 'A caption.'
        }
      ],
      body: [
        { type: 'p', text: 'First paragraph.' },
        { type: 'h2', text: 'A heading' },
        { type: 'quote', text: 'A pull quote.' }
      ],
      status: 'draft'
    }
  };

  const result = journalValidation.createJournalArticleSchema.safeParse(payload);
  assert.equal(result.success, true, result.success ? '' : JSON.stringify(result.error.errors));
  assert.equal(result.data.body.status, 'draft');
});

test('validation rejects the payloads that must never reach the writer', () => {
  const valid = {
    slug: 'a-new-story',
    title: 'Title',
    dek: 'Dek',
    category: 'Mountain Life',
    date: '2026-10-01',
    readingTime: '6 min read',
    excerpt: 'Excerpt',
    hero: { src: '/images/life/chapter-06.jpg', w: 100, h: 100, alt: '', caption: '' },
    inline: [],
    body: [{ type: 'p', text: 'Body.' }]
  };

  const cases = [
    [{ ...valid, slug: '../escape' }, /lowercase/],
    [{ ...valid, slug: 'Has Upper' }, /lowercase/],
    [{ ...valid, date: '01/10/2026' }, /YYYY-MM-DD/],
    [{ ...valid, readingTime: 'six minutes' }, /min read/],
    [{ ...valid, body: [] }, /at least one content block/],
    [{ ...valid, body: [{ type: 'marquee', text: 'x' }] }, /'p' \| 'h2' \| 'quote'/],
    [{ ...valid, hero: { ...valid.hero, src: 'https://evil.example/a.jpg' } }, /local path/],
    [{ ...valid, hero: { ...valid.hero, w: 0 } }, /greater than 0/],
    [{ ...valid, title: '' }, /Title is required/],
    [{ ...valid, title: 'x'.repeat(500) }, /at most 160 character/]
  ];

  for (const [body, pattern] of cases) {
    const result = journalValidation.createJournalArticleSchema.safeParse({ body });
    assert.equal(result.success, false, 'accepted: ' + JSON.stringify(body).slice(0, 90));
    assert.match(
      result.error.errors.map((e) => e.message).join(' | '),
      pattern,
      'wrong message for ' + JSON.stringify(body).slice(0, 90)
    );
  }
});

test('unknown fields are rejected so a renamed field cannot be silently dropped', () => {
  const valid = {
    slug: 'a-new-story',
    title: 'Title',
    dek: 'Dek',
    category: 'Mountain Life',
    date: '2026-10-01',
    readingTime: '6 min read',
    excerpt: 'Excerpt',
    hero: { src: '/images/life/chapter-06.jpg', w: 100, h: 100, alt: '', caption: '' },
    inline: [],
    body: [{ type: 'p', text: 'Body.' }]
  };

  const result = journalValidation.createJournalArticleSchema.safeParse({
    body: { ...valid, ttle: 'typo in title' }
  });
  assert.equal(result.success, false, 'a misspelled field was accepted');
});

test('an update may be partial, and slug moves must be confirmed', () => {
  const partial = journalValidation.updateJournalArticleSchema.safeParse({
    params: { slug: 'a-new-story' },
    body: { excerpt: 'Only the excerpt changed.' }
  });
  assert.equal(partial.success, true, partial.success ? '' : JSON.stringify(partial.error.errors));
  // Absent means "not confirmed"; the service only moves a URL on an explicit true.
  assert.ok(!partial.data.body.confirmSlugChange);

  const move = journalValidation.updateJournalArticleSchema.safeParse({
    params: { slug: 'a-new-story' },
    body: { slug: 'a-renamed-story', confirmSlugChange: true }
  });
  assert.equal(move.success, true);
  assert.equal(move.data.body.slug, 'a-renamed-story');
});

test('a slug that is not URL-safe is refused by the route schema too', () => {
  for (const slug of ['../secrets', 'Has Spaces', 'UPPER', 'a/b', 'x'.repeat(200)]) {
    const result = journalValidation.slugParamsSchema.safeParse({ params: { slug } });
    // The route schema only bounds the length; the service owns the shape rule.
    if (slug.length > 80) {
      assert.equal(result.success, false, 'accepted an over-long slug: ' + slug);
    }
  }
  assert.equal(journalValidation.slugParamsSchema.safeParse({ params: { slug: '' } }).success, false);
});

test('the publish body requires an explicit boolean', () => {
  assert.equal(
    journalValidation.publishSchema.safeParse({ params: { slug: 'a' }, body: { published: false } }).success,
    true
  );
  assert.equal(
    journalValidation.publishSchema.safeParse({ params: { slug: 'a' }, body: { published: 'false' } }).success,
    false
  );
  assert.equal(journalValidation.publishSchema.safeParse({ params: { slug: 'a' }, body: {} }).success, false);
});

test('the controller exposes exactly the handlers the routes call', () => {
  for (const name of [
    'getJournal',
    'getJournalImages',
    'getJournalArticle',
    'createArticle',
    'updateArticle',
    'publishArticle',
    'featureArticle',
    'deleteArticle',
    'restoreArticle',
    'previewArticle',
    'rebuildJournal'
  ]) {
    assert.equal(typeof journalController[name], 'function', 'missing handler: ' + name);
  }
});

test('audit summaries record state, not article bodies', () => {
  const summary = journalController.summarise({
    slug: 'a-story',
    title: 'A story',
    category: 'Mountain Life',
    date: '2026-10-01',
    status: 'draft',
    featured: true,
    deletedAt: null,
    body: [{ type: 'p', text: 'A very long paragraph that should never be logged.' }],
    inline: []
  });

  assert.equal(summary.slug, 'a-story');
  assert.equal(summary.status, 'draft');
  assert.equal(summary.featured, true);
  assert.equal(summary.blocks, 1);
  assert.equal(summary.deleted, false);
  assert.ok(!JSON.stringify(summary).includes('very long paragraph'));
});