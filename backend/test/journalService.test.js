const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const svc = require('../services/journalService');

const DATA_FILE = path.join(__dirname, '..', 'scripts', 'journalData.js');
const BLOG_DIR = path.join(__dirname, '..', '..', 'public', 'pages', 'blog');
const SITEMAP = path.join(__dirname, '..', '..', 'public', 'sitemap.xml');
const LANDING = path.join(__dirname, '..', '..', 'public', 'pages', 'blog.html');

const originalData = fs.readFileSync(DATA_FILE, 'utf8');
const originalBlog = {};
for (const name of fs.readdirSync(BLOG_DIR)) {
  originalBlog[name] = fs.readFileSync(path.join(BLOG_DIR, name), 'utf8');
}
const originalLanding = fs.readFileSync(LANDING, 'utf8');
const originalSitemap = fs.readFileSync(SITEMAP, 'utf8');

function restoreEverything() {
  fs.writeFileSync(DATA_FILE, originalData, 'utf8');
  for (const name of fs.readdirSync(BLOG_DIR)) {
    if (!(name in originalBlog)) fs.unlinkSync(path.join(BLOG_DIR, name));
  }
  for (const [name, contents] of Object.entries(originalBlog)) {
    fs.writeFileSync(path.join(BLOG_DIR, name), contents, 'utf8');
  }
  fs.writeFileSync(LANDING, originalLanding, 'utf8');
  fs.writeFileSync(SITEMAP, originalSitemap, 'utf8');
  delete require.cache[require.resolve(DATA_FILE)];
}

test.afterEach(() => {
  restoreEverything();
});

function sampleArticle(overrides) {
  return {
    slug: 'test-article-from-admin',
    title: 'A test article written by the admin panel',
    dek: 'Short standfirst used only by the automated tests.',
    category: 'Mountain Life',
    date: '2026-10-01',
    readingTime: '4 min read',
    excerpt: 'Excerpt used only by the automated tests.',
    hero: {
      src: '/images/life/chapter-06.jpg',
      w: 1776,
      h: 999,
      alt: 'Morning light across the forested hills',
      caption: 'Hills above Jibhi.'
    },
    inline: [],
    body: [{ type: 'p', text: 'One paragraph of body copy for the tests.' }],
    ...overrides
  };
}

test('slug validation rejects traversal, uppercase, spaces and reserved names', () => {
  assert.equal(svc.assertSlug('a-fine-slug'), 'a-fine-slug');
  assert.equal(svc.assertSlug('  trimmed-1  '), 'trimmed-1');

  for (const bad of [
    '../escape',
    'a/b',
    'Upper-Case',
    'two words',
    'double--hyphen',
    'trailing-',
    '-leading',
    'nul',
    'COM1',
    'a'.repeat(81)
  ]) {
    assert.throws(() => svc.assertSlug(bad), /slug|Slug|reserved/i, 'accepted: ' + bad);
  }
});

test('image src must be a local /images/ path with no traversal', () => {
  const base = { w: 100, h: 100, alt: 'a', caption: 'c' };

  assert.deepStrictEqual(svc.assertImage({ ...base, src: '/images/rooms/01.jpg' }, 'Hero').src, '/images/rooms/01.jpg');

  for (const bad of [
    'https://example.com/a.jpg',
    '//example.com/a.jpg',
    'javascript:alert(1)',
    '/images/../../secret.jpg',
    '/uploads/../x.jpg',
    '/images/',
    'images/a.jpg'
  ]) {
    assert.throws(
      () => svc.assertImage({ ...base, src: bad }, 'Hero'),
      /image src|image may not/i,
      'accepted: ' + bad
    );
  }
});

test('body blocks are restricted to the three rendered types', () => {
  assert.equal(svc.assertBody([{ type: 'p', text: 'x' }]).length, 1);
  for (const type of ['h2', 'quote']) {
    assert.equal(svc.assertBody([{ type, text: 'x' }])[0].type, type);
  }
  assert.throws(() => svc.assertBody([{ type: 'script', text: 'x' }]), /must be one of/i);
  assert.throws(() => svc.assertBody([]), /at least one content block/i);
  assert.throws(() => svc.assertBody('nope'), /at least one content block/i);
});

test('body text cannot smuggle HTML: the generator escapes it', () => {
  const article = svc.normaliseArticle(
    sampleArticle({
      body: [{ type: 'p', text: '<script>alert(1)</script>' }]
    })
  );
  assert.equal(article.body[0].text, '<script>alert(1)</script>');

  // eslint-disable-next-line global-require
  const builder = require('../scripts/buildJournal');
  const html = builder.buildArticleHtml(article);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script tag reached the page');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('reading time and date formats are enforced', () => {
  assert.equal(svc.assertReadingTime(' 6   min read '), '6 min read');
  assert.throws(() => svc.assertReadingTime('six minutes'), /min read/i);
  assert.throws(() => svc.assertReadingTime('6 min'), /min read/i);
  assert.equal(svc.assertDate('2026-09-24'), '2026-09-24');
  assert.throws(() => svc.assertDate('24/09/2026'), /YYYY-MM-DD/);
  assert.throws(() => svc.assertDate('2026-13-01'), /real calendar date/);
});

test('category must already exist on the site', () => {
  assert.throws(
    () => svc.normaliseArticle(sampleArticle({ category: 'Not A Category' })),
    /Unknown category/
  );
  assert.doesNotThrow(() => svc.normaliseArticle(sampleArticle({ category: 'Food & Café' })));
});

test('only one article can be featured', () => {
  const list = [
    { slug: 'a', featured: true },
    { slug: 'b', featured: true }
  ];
  assert.throws(() => svc.assertInvariants(list), /Only one article can be featured/);
  assert.doesNotThrow(() => svc.assertInvariants([{ slug: 'a', featured: true }, { slug: 'b', featured: null }]));
});

test('duplicate slugs are rejected', () => {
  assert.throws(
    () => svc.assertInvariants([{ slug: 'same' }, { slug: 'same' }]),
    /already used by another article/
  );
});

test('serialiser round-trips through the data module and keeps the header comment', () => {
  const data = {
    CATEGORIES: ['All', 'Stories from Jibhi'],
    ARTICLES: [
      svc.normaliseArticle(sampleArticle({ slug: 'quote-and-amp' })),
      svc.normaliseArticle(
        sampleArticle({
          slug: 'tricky',
          title: "It's a 'quoted' title with \\ backslash",
          dek: 'Ampersand & angle <brackets>',
          body: [{ type: 'quote', text: 'Line one\nLine two' }]
        })
      )
    ]
  };

  const serialised = svc.serialise(data);
  assert.ok(serialised.includes('FAM JOURNAL - content data'), 'header comment was lost');

  const tmp = path.join(__dirname, '.journal-roundtrip.tmp.js');
  fs.writeFileSync(tmp, serialised, 'utf8');
  let reloaded;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    reloaded = require(tmp);
  } finally {
    fs.unlinkSync(tmp);
  }

  assert.deepStrictEqual(reloaded.CATEGORIES, data.CATEGORIES);
  assert.equal(reloaded.ARTICLES.length, 2);
  assert.equal(reloaded.ARTICLES[1].title, "It's a 'quoted' title with \\ backslash");
  assert.equal(reloaded.ARTICLES[1].dek, 'Ampersand & angle <brackets>');
  assert.equal(reloaded.ARTICLES[1].body[0].text, 'Line one\nLine two');
});

test('lifecycle fields are only written when they carry information', () => {
  const live = svc.serialise({
    CATEGORIES: ['All'],
    ARTICLES: [svc.normaliseArticle(sampleArticle())]
  });
  assert.ok(!/status: 'draft'/.test(live), 'a published article should carry no status');
  assert.ok(!/deletedAt:/.test(live), 'a live article should carry no deletedAt');
  assert.ok(/featured: null/.test(live));

  const draft = svc.serialise({
    CATEGORIES: ['All'],
    ARTICLES: [
      Object.assign(svc.normaliseArticle(sampleArticle()), {
        status: 'draft',
        updatedAt: '2026-10-01T00:00:00.000Z'
      })
    ]
  });
  assert.ok(/status: 'draft'/.test(draft));
  assert.ok(/updatedAt: "2026-10-01T00:00:00.000Z"/.test(draft));
});

test('lifecycle fields survive a write, so drafts round-trip through the file', () => {
  const article = Object.assign(svc.normaliseArticle(sampleArticle()), { status: 'draft' });
  const tmp = path.join(__dirname, '.journal-lifecycle.tmp.js');
  fs.writeFileSync(
    tmp,
    svc.serialise({ CATEGORIES: ['All', 'Mountain Life'], ARTICLES: [article] }),
    'utf8'
  );
  let reloaded;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    reloaded = require(tmp);
  } finally {
    fs.unlinkSync(tmp);
  }
  assert.equal(reloaded.ARTICLES[0].status, 'draft');
  assert.equal(svc.isLive(reloaded.ARTICLES[0]), false);
  assert.equal(svc.isLive({}), true, 'an article with no lifecycle fields is published');
});

test('create then delete puts the article on the site and then takes it off again', async () => {
  const before = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.html'));

  const created = await svc.create(sampleArticle());
  assert.equal(created.slug, 'test-article-from-admin');
  assert.equal(created.isPublished, true);

  const after = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.html'));
  assert.deepStrictEqual(after.sort(), before.concat('test-article-from-admin.html').sort());

  const page = fs.readFileSync(path.join(BLOG_DIR, 'test-article-from-admin.html'), 'utf8');
  assert.ok(page.includes('A test article written by the admin panel'));
  assert.ok(fs.readFileSync(SITEMAP, 'utf8').includes('/pages/blog/test-article-from-admin.html'));

  await svc.remove('test-article-from-admin');

  assert.ok(
    !fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')),
    'the deleted page was left on disk'
  );
  assert.ok(
    !fs.readFileSync(SITEMAP, 'utf8').includes('/pages/blog/test-article-from-admin.html'),
    'the deleted article is still in the sitemap'
  );
  assert.ok(
    !fs.readFileSync(LANDING, 'utf8').includes('test-article-from-admin'),
    'the deleted article is still listed on the landing page'
  );
  // Soft delete: the text is still recoverable.
  assert.ok(svc.getBySlug('test-article-from-admin').deletedAt);
});

test('a draft is never published, counted or listed', async () => {
  const created = await svc.create(sampleArticle({ status: 'draft' }));
  assert.equal(created.isPublished, false);

  assert.ok(!fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')));
  assert.ok(!fs.readFileSync(SITEMAP, 'utf8').includes('test-article-from-admin'));
  assert.ok(!fs.readFileSync(LANDING, 'utf8').includes('test-article-from-admin'));

  await svc.setPublished('test-article-from-admin', true);
  assert.ok(fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')));

  await svc.setPublished('test-article-from-admin', false);
  assert.ok(!fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')));
  assert.ok(!fs.readFileSync(SITEMAP, 'utf8').includes('test-article-from-admin'));
});

test('publishing cannot empty the Journal', async () => {
  const list = svc.list();
  // Unpublish every article: the last one standing must be refused.
  let refused = null;
  for (const article of list.articles) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await svc.setPublished(article.slug, false);
    } catch (error) {
      refused = error;
    }
  }
  assert.ok(refused, 'the Journal was allowed to go completely empty');
  assert.match(refused.message, /At least one article must stay published/);
  assert.ok(fs.existsSync(LANDING), 'the landing page was removed');
});

test('changing the slug of a published article needs explicit confirmation', async () => {
  await svc.create(sampleArticle());
  await assert.rejects(
    () => svc.update('test-article-from-admin', { slug: 'renamed-article' }),
    /Confirm the change|moves the published URL/
  );

  const updated = await svc.update('test-article-from-admin', {
    slug: 'renamed-article',
    confirmSlugChange: true
  });
  assert.equal(updated.slug, 'renamed-article');
  assert.ok(fs.existsSync(path.join(BLOG_DIR, 'renamed-article.html')));
  assert.ok(!fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')));
  assert.ok(!fs.readFileSync(SITEMAP, 'utf8').includes('/pages/blog/test-article-from-admin.html'));
});

test('setting featured clears the previous featured article and moves only one', async () => {
  const first = svc.list().articles.find((a) => a.featured === true);
  assert.ok(first, 'the starter data should have a featured article');

  await svc.create(sampleArticle());
  const result = await svc.setFeatured('test-article-from-admin');
  assert.deepStrictEqual(result.featured, 'test-article-from-admin');

  const featured = svc.list().articles.filter((a) => a.featured === true);
  assert.deepStrictEqual(featured.map((a) => a.slug), ['test-article-from-admin']);

  const landing = fs.readFileSync(LANDING, 'utf8');
  assert.ok(landing.includes('A test article written by the admin panel'));
});

test('a draft cannot be featured, and unpublishing drops the featured flag', async () => {
  await svc.create(sampleArticle({ status: 'draft' }));
  await assert.rejects(() => svc.setFeatured('test-article-from-admin'), /published article can be featured/);

  await svc.setPublished('test-article-from-admin', true);
  await svc.setFeatured('test-article-from-admin');
  await svc.setPublished('test-article-from-admin', false);

  const featured = svc.list().articles.filter((a) => a.featured === true);
  assert.ok(featured.length <= 1);
  assert.ok(!featured.some((a) => a.slug === 'test-article-from-admin'));
});

test('preview renders a draft with noindex, and a live article without it', async () => {
  // eslint-disable-next-line global-require
  const builder = require('../scripts/buildJournal');

  await svc.create(sampleArticle({ status: 'draft' }));
  const draft = svc.preview('test-article-from-admin');
  assert.equal(draft.isPublished, false);
  assert.ok(/noindex, nofollow/.test(draft.html), 'draft preview is missing noindex');
  assert.ok(/name="googlebot"/.test(draft.html));
  assert.ok(draft.html.includes('A test article written by the admin panel'));
  // The preview is the generator's own markup, not a second renderer.
  assert.ok(draft.html.includes('journal-article'));
  assert.ok(
    draft.html === builder.buildArticleHtml(svc.getBySlug('test-article-from-admin'), { noindex: true }),
    'preview drifted from the generator markup'
  );

  const live = svc.preview('mountain-mornings');
  assert.equal(live.isPublished, true);
  assert.ok(!/noindex/.test(live.html), 'a published article must not preview as noindex');
});

test('a build that fails part way through leaves nothing behind', async () => {
  const beforeData = fs.readFileSync(DATA_FILE, 'utf8');
  const beforeLanding = fs.readFileSync(LANDING, 'utf8');
  const beforeSitemap = fs.readFileSync(SITEMAP, 'utf8');
  const beforeFiles = fs.readdirSync(BLOG_DIR).sort();

  // An undeclared category makes the generator throw only after it has already
  // written pages, which is the case worth guarding: commit() must put the
  // previous version of the data file, the pages and the sitemap all back.
  const broken = svc.normaliseArticle(sampleArticle());
  broken.category = 'Category The Generator Rejects';

  await assert.rejects(
    () => svc.commit((next) => {
      next.ARTICLES.push(broken);
      return next;
    }),
    /build failed|did not verify/i
  );

  assert.equal(fs.readFileSync(DATA_FILE, 'utf8'), beforeData, 'journalData.js was not restored');
  assert.equal(fs.readFileSync(LANDING, 'utf8'), beforeLanding, 'blog.html was not restored');
  assert.equal(fs.readFileSync(SITEMAP, 'utf8'), beforeSitemap, 'sitemap.xml was not restored');
  assert.deepStrictEqual(
    fs.readdirSync(BLOG_DIR).sort(),
    beforeFiles,
    'a failed build left extra or missing article pages'
  );
});

test('rollback happens when the generator reports a non-zero exit', async () => {
  const beforeData = fs.readFileSync(DATA_FILE, 'utf8');

  await assert.rejects(
    () =>
      svc.commit((next) => {
        const article = svc.normaliseArticle(sampleArticle());
        article.category = 'Not Declared';
        next.ARTICLES.push(article);
        return next;
      }),
    /build failed|did not verify/i
  );

  assert.equal(fs.readFileSync(DATA_FILE, 'utf8'), beforeData);
  const html = fs.readFileSync(LANDING, 'utf8');
  assert.ok(!html.includes('test-article-from-admin'));
});

test('the build is launched with a fixed argv and no shell', () => {
  // The service holds no template for the command line; the only executable is
  // the current node binary and the only argument is the generator path.
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'journalService.js'), 'utf8');
  const call = src.slice(src.indexOf('execFile('), src.indexOf('execFile(') + 400);
  assert.ok(/process\.execPath/.test(call), 'must run the node binary, not a shell string');
  assert.ok(/BUILD_SCRIPT/.test(call), 'must pass the fixed script path');
  assert.ok(!/exec\(/.test(src), 'must not use shell exec');
  assert.ok(!/\$\{/.test(call.slice(0, call.indexOf('},'))), 'command must not be built from input');
});

test('restore brings a soft-deleted article back to the public site', async () => {
  await svc.create(sampleArticle());
  await svc.remove('test-article-from-admin');
  assert.ok(!fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')));

  await svc.restoreArticle('test-article-from-admin');
  assert.ok(fs.existsSync(path.join(BLOG_DIR, 'test-article-from-admin.html')));
  assert.equal(svc.getBySlug('test-article-from-admin').isPublished, true);
});

test('restoring an article that is not deleted is refused', async () => {
  await assert.rejects(() => svc.restoreArticle('mountain-mornings'), /not deleted/);
});

test('updating an article rewrites its page and the sitemap date', async () => {
  const updated = await svc.update('mountain-mornings', {
    title: 'Mountain Mornings, revised by the admin panel'
  });
  assert.equal(updated.title, 'Mountain Mornings, revised by the admin panel');

  const page = fs.readFileSync(path.join(BLOG_DIR, 'mountain-mornings.html'), 'utf8');
  assert.ok(page.includes('Mountain Mornings, revised by the admin panel'));
  assert.ok(fs.readFileSync(LANDING, 'utf8').includes('Mountain Mornings, revised by the admin panel'));
});

test('a partial update keeps the fields it did not mention', async () => {
  const before = svc.getBySlug('mountain-mornings');
  await svc.update('mountain-mornings', { excerpt: 'A brand new excerpt from the admin panel.' });
  const after = svc.getBySlug('mountain-mornings');

  assert.equal(after.excerpt, 'A brand new excerpt from the admin panel.');
  assert.equal(after.title, before.title);
  assert.equal(after.dek, before.dek);
  assert.equal(after.hero.src, before.hero.src);
  assert.deepStrictEqual(after.body, before.body);
});

test('missing articles return a 404 rather than crashing', async () => {
  assert.throws(() => svc.getBySlug('does-not-exist'), /No Journal article/);
  assert.throws(() => svc.preview('does-not-exist'), /No Journal article/);
  await assert.rejects(() => svc.update('does-not-exist', { excerpt: 'x' }), /No Journal article/);
});

test('an unknown slug on update does not modify the data file', async () => {
  const before = fs.readFileSync(DATA_FILE, 'utf8');
  await assert.rejects(() => svc.update('does-not-exist', { excerpt: 'x' }), /No Journal article/);
  assert.equal(fs.readFileSync(DATA_FILE, 'utf8'), before);
});

test('creating an article whose slug is taken is refused', async () => {
  await svc.create(sampleArticle());
  await assert.rejects(() => svc.create(sampleArticle()), /already used/);

  // The clash is caught before anything is written or built.
  const after = fs.readFileSync(DATA_FILE, 'utf8');
  const occurrences = (after.match(/slug: "test-article-from-admin"/g) || []).length;
  assert.equal(occurrences, 1);
});

test('the generator still runs cleanly and leaves the committed pages untouched', () => {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'buildJournal.js')], {
    stdio: 'pipe'
  });
  assert.equal(fs.readFileSync(LANDING, 'utf8'), originalLanding);
  // Compare the sitemap with <lastmod> stripped: the generator refreshes the
  // blog block's lastmod to the day it runs, so a byte comparison would fail
  // on any day after the committed sitemap was generated. Every URL, priority
  // and the surrounding markup must still be byte-identical.
  const withoutLastmod = (xml) => xml.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  assert.equal(withoutLastmod(fs.readFileSync(SITEMAP, 'utf8')), withoutLastmod(originalSitemap));
});

test('the sitemap contains no duplicate or malformed URLs', () => {
  const xml = fs.readFileSync(SITEMAP, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'duplicate <loc> entries');

  const journal = locs.filter((l) => l.includes('/pages/blog'));
  assert.ok(journal.length > 0);
  for (const loc of journal) {
    assert.match(loc, /^https:\/\/flamingoaurmaina\.com\/pages\/blog(\/[a-z0-9-]+)?\.html$/);
  }
});

test('every generated article image points at a file that exists', () => {
  const publicDir = path.join(__dirname, '..', '..', 'public');
  const missing = [];
  for (const name of fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(BLOG_DIR, name), 'utf8');
    for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      const src = m[1];
      if (!src.startsWith('/images/')) continue;
      if (!fs.existsSync(path.join(publicDir, src.replace(/^\//, '')))) missing.push(name + ' -> ' + src);
    }
  }
  assert.deepStrictEqual(missing, []);
});

test('every generated article image has an alt attribute or a deliberate empty one', () => {
  for (const name of fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(BLOG_DIR, name), 'utf8');
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      assert.ok(/\balt\s*=/.test(m[0]), name + ': ' + m[0].slice(0, 80));
    }
  }
});

test('draft and deleted articles never leak into generated output', async () => {
  await svc.create(sampleArticle({ status: 'draft' }));
  await svc.create(sampleArticle({ slug: 'hidden-then-deleted' }));
  await svc.remove('hidden-then-deleted');

  const output = [
    fs.readFileSync(LANDING, 'utf8'),
    fs.readFileSync(SITEMAP, 'utf8'),
    ...fs.readdirSync(BLOG_DIR).map((f) => fs.readFileSync(path.join(BLOG_DIR, f), 'utf8'))
  ].join('\n');

  assert.ok(!output.includes('test-article-from-admin'), 'a draft leaked into the public output');
  assert.ok(!output.includes('hidden-then-deleted'), 'a deleted article leaked into the public output');
});

test('the service restores the data file exactly, byte for byte, after a test', () => {
  assert.equal(fs.readFileSync(DATA_FILE, 'utf8'), originalData);
});