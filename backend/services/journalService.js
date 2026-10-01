/**
 * Journal data store.
 *
 * The Journal is a static site, so its source of truth is a CommonJS file on
 * disk (backend/scripts/journalData.js) that buildJournal.js turns into HTML.
 * The admin panel is a controlled editor for that file: it reads the data,
 * applies a validated mutation, writes it back and re-runs the existing
 * generator. There is no database and no second content store, by design.
 *
 * Everything that leaves this module has been through the invariants in
 * assertInvariants() and written by hand here. We never eval, require or
 * concatenate administrator input into a JavaScript file, and the build is
 * launched as a fixed argv with no shell, so an admin cannot smuggle code in
 * through a title, a slug or a path.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ApiError = require('../utils/ApiError');

const DATA_FILE = path.join(__dirname, '..', 'scripts', 'journalData.js');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'buildJournal.js');


/* Output paths owned by the generator. They live in buildJournal.js so there is
   one definition of where the Journal is written; this module never guesses. */
function outputPaths() {
  // eslint-disable-next-line global-require
  const builder = require('../scripts/buildJournal');
  return {
    BLOG_DIR: builder.BLOG_DIR,
    LANDING_FILE: path.join(builder.PAGES, 'blog.html'),
    SITEMAP_FILE: path.join(builder.ROOT, 'sitemap.xml')
  };
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Windows-reserved device names. A slug becomes a filename under
   public/pages/blog/, so these must never be allowed through. */
const RESERVED_SLUGS = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const LIMITS = {
  title: 160,
  dek: 320,
  category: 60,
  excerpt: 400,
  alt: 200,
  caption: 300,
  readingTime: 40,
  blockText: 5000,
  slug: 80,
  bodyBlocks: 300,
  inlineImages: 30,
};

const BODY_TYPES = new Set(['p', 'h2', 'quote']);

/* The data file is small, and it is written by this process but can also be
   edited by hand or by a deploy. Always reading it fresh keeps the admin panel
   from showing content that is no longer on disk; the generator pays the same
   cost on every run anyway. */
function read() {
  delete require.cache[require.resolve(DATA_FILE)];
  // eslint-disable-next-line global-require
  const data = require(DATA_FILE);
  if (!data || !Array.isArray(data.ARTICLES) || !Array.isArray(data.CATEGORIES)) {
    throw new Error('journalData.js did not export CATEGORIES and ARTICLES arrays');
  }
  return data;
}

/* -------------------------------------------------------------- validation */

function assertSlug(slug) {
  if (typeof slug !== 'string') throw ApiError.badRequest('Slug is required');
  const value = slug.trim();
  if (!value) throw ApiError.badRequest('Slug is required');
  if (value.length > LIMITS.slug) {
    throw ApiError.badRequest(`Slug must be ${LIMITS.slug} characters or fewer`);
  }
  if (!SLUG_RE.test(value)) {
    throw ApiError.badRequest(
      'Slug may only use lowercase letters, numbers and single hyphens (for example: a-slow-morning)'
    );
  }
  if (RESERVED_SLUGS.has(value)) {
    throw ApiError.badRequest(`"${value}" is a reserved filename and cannot be used as a slug`);
  }
  return value;
}

function assertText(value, field, { required = true, max } = {}) {
  if (value === undefined || value === null) {
    if (required) throw ApiError.badRequest(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be text`);
  const text = value.trim();
  if (required && !text) throw ApiError.badRequest(`${field} is required`);
  const limit = max || LIMITS[field] || 2000;
  if (text.length > limit) {
    throw ApiError.badRequest(`${field} must be ${limit} characters or fewer`);
  }
  return text;
}

function assertImage(value, field) {
  if (!value || typeof value !== 'object') {
    throw ApiError.badRequest(`${field} image is required`);
  }

  const rawSrc = assertText(value.src, `${field} image src`, { max: 300 });
  // Only local paths under /images/ are accepted. This is the existing Journal
  // convention, and it is what keeps a crafted src from turning into an
  // off-site image or a path traversal when the generator writes <img src>.
  if (!/^\/images\/[A-Za-z0-9._\-/]+$/.test(rawSrc)) {
    throw ApiError.badRequest(
      `${field} image src must be a local path under /images/ (no http URLs, no ..)`
    );
  }
  if (rawSrc.split('/').some((seg) => seg === '..' || seg === '.')) {
    throw ApiError.badRequest(`${field} image src may not contain path segments like ..`);
  }

  const w = Number(value.w);
  const h = Number(value.h);
  if (!Number.isInteger(w) || w <= 0 || w > 10000) {
    throw ApiError.badRequest(`${field} image width must be a positive whole number`);
  }
  if (!Number.isInteger(h) || h <= 0 || h > 10000) {
    throw ApiError.badRequest(`${field} image height must be a positive whole number`);
  }

  return {
    src: rawSrc,
    w,
    h,
    alt: assertText(value.alt, `${field} image alt`, { required: false, max: LIMITS.alt }),
    caption: assertText(value.caption, `${field} image caption`, {
      required: false,
      max: LIMITS.caption
    })
  };
}

function assertInline(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw ApiError.badRequest('Inline images must be a list');
  if (value.length > LIMITS.inlineImages) {
    throw ApiError.badRequest(`An article can hold at most ${LIMITS.inlineImages} inline images`);
  }
  return value.map((img, i) => assertImage(img, `Inline image ${i + 1}`));
}

function assertBody(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw ApiError.badRequest('An article needs at least one content block');
  }
  if (value.length > LIMITS.bodyBlocks) {
    throw ApiError.badRequest(`An article can hold at most ${LIMITS.bodyBlocks} content blocks`);
  }
  return value.map((block, i) => {
    if (!block || typeof block !== 'object') {
      throw ApiError.badRequest(`Content block ${i + 1} is not valid`);
    }
    if (!BODY_TYPES.has(block.type)) {
      throw ApiError.badRequest(
        `Content block ${i + 1} must be one of: ${[...BODY_TYPES].join(', ')}`
      );
    }
    return {
      type: block.type,
      // Plain text only. buildJournal escapes it before writing HTML, so there
      // is no HTML or script path into a published page.
      text: assertText(block.text, `Content block ${i + 1} text`, { max: LIMITS.blockText })
    };
  });
}

function assertDate(value) {
  const date = assertText(value, 'date', { max: 10 });
  if (!ISO_DATE_RE.test(date)) throw ApiError.badRequest('Date must use the YYYY-MM-DD format');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest('Date is not a real calendar date');
  return date;
}

function assertReadingTime(value) {
  const text = assertText(value, 'readingTime', { max: LIMITS.readingTime });
  if (!/^\d+\s+min read$/i.test(text)) {
    throw ApiError.badRequest('Reading time must look like "6 min read"');
  }
  return text.replace(/\s+/g, ' ');
}

/**
 * Normalise one article coming from the admin request into the exact shape the
 * generator expects, rejecting anything unknown so a typo in the editor cannot
 * silently produce an article page missing its hero or its body.
 */
function normaliseArticle(input, { existing } = {}) {
  const source = { ...(existing || {}), ...(input || {}) };

  const article = {
    slug: assertSlug(source.slug),
    title: assertText(source.title, 'title', { max: LIMITS.title }),
    dek: assertText(source.dek, 'dek', { max: LIMITS.dek }),
    category: assertText(source.category, 'category', { max: LIMITS.category }),
    date: assertDate(source.date),
    readingTime: assertReadingTime(source.readingTime),
    // `featured` is null, not false, in the hand-authored data; keep that shape.
    featured: source.featured === true || source.featured === 'true' ? true : null,
    excerpt: assertText(source.excerpt, 'excerpt', { max: LIMITS.excerpt }),
    hero: assertImage(source.hero, 'Hero'),
    inline: assertInline(source.inline),
    body: assertBody(source.body)
  };

  if (!read().CATEGORIES.includes(article.category)) {
    throw ApiError.badRequest(
      `Unknown category "${article.category}". Use one of the categories already on the site.`
    );
  }

  if (input && 'slug' in input && existing && input.slug !== existing.slug) {
    article.slugChanged = true;
  }
  return article;
}

/**
 * Whole-file invariants. These are the rules the static site cannot express on
 * its own, so they are checked before anything is written.
 */
function assertInvariants(articles) {
  const seen = new Set();
  articles.forEach((article) => {
    if (seen.has(article.slug)) {
      throw ApiError.conflict(`Slug "${article.slug}" is already used by another article`);
    }
    seen.add(article.slug);
  });

  const featured = articles.filter((a) => a.featured === true);
  if (featured.length > 1) {
    throw ApiError.badRequest(
      `Only one article can be featured. Currently featured: ${featured
        .map((a) => a.slug)
        .join(', ')}`
    );
  }
  return articles;
}

/* ------------------------------------------------------------ serialisation */

/* The data file is hand-written and documented. Rather than generate the whole
   file and throw its comments away, only the CATEGORIES and ARTICLES literals
   are replaced, and the header comment above them is preserved. */
function serialise(data) {
  const source = fs.readFileSync(DATA_FILE, 'utf8');

  const categoriesStart = source.indexOf('const CATEGORIES = [');
  const articlesStart = source.indexOf('const ARTICLES = [');
  if (categoriesStart === -1 || articlesStart === -1) {
    throw new Error(
      'journalData.js is missing the expected CATEGORIES or ARTICLES declaration. ' +
        'Restore it before saving from the admin panel.'
    );
  }

  const before = source.slice(0, categoriesStart);
  const between = source.slice(
    source.indexOf('];', categoriesStart) + 2,
    articlesStart
  );
  const exportsTail = source.slice(source.indexOf('module.exports', articlesStart));

  return (
    before +
    stringifyCategories(data.CATEGORIES) +
    between +
    `const ARTICLES = ${stringifyArticles(data.ARTICLES)};\n\n` +
    exportsTail
  );
}

function stringifyCategories(categories) {
  return `const CATEGORIES = [\n${categories.map((c) => `  ${jsString(c)}`).join(',\n')}\n];\n`;
}

/* Article objects are emitted as readable JS literals rather than JSON so the
   file stays something a human can open and edit if it ever has to be. */
function stringifyArticles(articles) {
  const lines = articles.map((article) => {
    const fields = [
      `    slug: ${jsString(article.slug)}`,
      `    title: ${jsString(article.title)}`,
      `    dek: ${jsString(article.dek)}`,
      `    category: ${jsString(article.category)}`,
      `    date: ${jsString(article.date)}`,
      `    readingTime: ${jsString(article.readingTime)}`,
      `    featured: ${article.featured === true ? 'true' : 'null'}`,
      `    excerpt: ${jsString(article.excerpt)}`,
      `    hero: ${stringifyImage(article.hero)}`,
      ...articleLifecycle(article),
      `    inline: [\n${article.inline.map((img) => `      ${stringifyImage(img)}`).join(',\n')}\n    ]`,
      `    body: [\n${article.body
        .map((b) => `      { type: ${jsString(b.type)}, text: ${jsString(b.text)} }`)
        .join(',\n')}\n    ]`
    ];
    return `  {\n${fields.join(',\n')}\n  }`;
  });
  return `[\n${lines.join(',\n')}\n]`;
}

/* Lifecycle keys are written only when they carry information, so untouched
   articles keep looking exactly like the hand-authored originals. */
function articleLifecycle(article) {
  const fields = [];
  if (article.status === 'draft') fields.push(`    status: 'draft'`);
  if (article.deletedAt) fields.push(`    deletedAt: ${jsString(article.deletedAt)}`);
  if (article.updatedAt) fields.push(`    updatedAt: ${jsString(article.updatedAt)}`);
  return fields;
}

function stringifyImage(image) {
  return (
    '{\n' +
    `      src: ${jsString(image.src)},\n` +
    `      w: ${image.w},\n` +
    `      h: ${image.h},\n` +
    `      alt: ${jsString(image.alt)},\n` +
    `      caption: ${jsString(image.caption)}\n` +
    '    }'
  );
}

/* JSON.stringify gives correct escaping for quotes, backslashes, newlines and
   control characters; the only change needed is that JSON is not valid JS for
   U+2028/U+2029 in older engines, so those are escaped explicitly. */
function jsString(value) {
  return JSON.stringify(String(value))
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/* --------------------------------------------------------------- persistence */

function writeDataFile(next) {
  const contents = serialise(next);
  // Write to a sibling temp file and rename, so a crash mid-write cannot leave
  // the generator reading a half-written module.
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, contents, 'utf8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (error) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw error;
  }
  // Load it straight back. If the emitted file is not valid JavaScript or does
  // not round-trip, the caller rolls back before the generator ever runs.
  read();
}

/* ------------------------------------------------------------ build & rollback */

/* Launched with a fixed argv and no shell. The admin cannot influence which
   program runs or what arguments it receives. */
function runBuild() {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [BUILD_SCRIPT],
      {
        cwd: path.join(__dirname, '..'),
        timeout: 60000,
        windowsHide: true,
        env: { PATH: process.env.PATH || '' }
      },
      (error, stdout, stderr) => {
        resolve({
          code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          failed: Boolean(error)
        });
      }
    );
  });
}

/**
 * Snapshot everything the generator can touch, so a failed build can be undone.
 * Both the data file and the generated output are backed up: restoring only one
 * of the two would leave the site inconsistent.
 */
function snapshot() {
  const blog = outputPaths();
  const blogFiles = fs.existsSync(blog.BLOG_DIR) ? fs.readdirSync(blog.BLOG_DIR) : [];
  const files = {};
  blogFiles.forEach((name) => {
    const full = path.join(blog.BLOG_DIR, name);
    if (fs.statSync(full).isFile()) files[name] = fs.readFileSync(full, 'utf8');
  });

  return {
    data: fs.readFileSync(DATA_FILE, 'utf8'),
    landing: fs.existsSync(blog.LANDING_FILE)
      ? fs.readFileSync(blog.LANDING_FILE, 'utf8')
      : null,
    sitemap: fs.existsSync(blog.SITEMAP_FILE)
      ? fs.readFileSync(blog.SITEMAP_FILE, 'utf8')
      : null,
    blogFiles: files
  };
}

function restore(backup) {
  fs.writeFileSync(DATA_FILE, backup.data, 'utf8');

  const blog = outputPaths();
  fs.mkdirSync(blog.BLOG_DIR, { recursive: true });

  const keep = new Set(Object.keys(backup.blogFiles));
  fs.readdirSync(blog.BLOG_DIR)
    .filter((name) => !keep.has(name))
    .forEach((name) => {
      const full = path.join(blog.BLOG_DIR, name);
      if (fs.statSync(full).isFile()) fs.unlinkSync(full);
    });

  Object.entries(backup.blogFiles).forEach(([name, contents]) => {
    fs.writeFileSync(path.join(blog.BLOG_DIR, name), contents, 'utf8');
  });

  if (backup.landing !== null) fs.writeFileSync(blog.LANDING_FILE, backup.landing, 'utf8');
  if (backup.sitemap !== null) fs.writeFileSync(blog.SITEMAP_FILE, backup.sitemap, 'utf8');
}



/**
 * Verify that the generator actually produced what we asked for. A build that
 * exits 0 but silently skipped an article is still a failed save as far as the
 * person clicking Publish is concerned.
 */
function verifyOutput(published) {
  const blog = outputPaths();

  if (!fs.existsSync(blog.LANDING_FILE)) {
    throw new Error('public/pages/blog.html was not generated');
  }

  const missing = published.filter(
    (a) => !fs.existsSync(path.join(blog.BLOG_DIR, `${a.slug}.html`))
  );
  if (missing.length) {
    throw new Error(`Article pages were not generated: ${missing.map((a) => a.slug).join(', ')}`);
  }

  const sitemap = fs.readFileSync(blog.SITEMAP_FILE, 'utf8');
  const absent = published.filter((a) => !sitemap.includes(`/pages/blog/${a.slug}.html`));
  if (absent.length) {
    throw new Error(`Sitemap is missing: ${absent.map((a) => a.slug).join(', ')}`);
  }
}

/* ------------------------------------------------------------ image library */

/* The Journal uses local photography under public/images, so the editor's image
   picker lists what is actually on disk rather than accepting a typed path.
   Only these extensions are offered; anything else in the folder is not a web
   image and is left alone. */
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_IMAGES = 2000;

/**
 * Read the pixel dimensions out of the file itself.
 *
 * The generator writes width/height onto every <img>, so guessing them in the
 * browser is how a Journal page ends up with a hero image that reflows the
 * article as it loads. Reading the header is cheap and makes the editor's
 * preview correct by default.
 */
function readImageSize(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(65536);
    const read = fs.readSync(fd, buffer, 0, buffer.length, 0);

    // PNG: 8-byte signature, then IHDR with big-endian width/height.
    if (
      read > 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // GIF: "GIF87a"/"GIF89a" then little-endian dimensions.
    if (read > 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }

    // JPEG: walk the segment chain to the start-of-frame marker.
    if (read > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < read) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        // SOF0-SOF15, excluding the DHT/JPG/DAC markers in that range.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7)
          };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }

    // WebP: RIFF container, three possible bitstream layouts.
    if (read > 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const kind = buffer.toString('ascii', 12, 16);
      if (kind === 'VP8 ') {
        return {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff
        };
      }
      if (kind === 'VP8L') {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (kind === 'VP8X') {
        return {
          width: (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1,
          height: (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1
        };
      }
    }
  } catch (error) {
    // A file we cannot read a size from is still listable; the editor can fill
    // the dimensions in by hand.
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return null;
}

function listImages() {
  const builder = require('../scripts/buildJournal');
  const imagesRoot = path.join(builder.ROOT, 'images');
  const found = [];

  const walk = (dir) => {
    if (found.length >= MAX_IMAGES) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      return;
    }
    for (const entry of entries) {
      if (found.length >= MAX_IMAGES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const rel = `/${path.relative(builder.ROOT, full).split(path.sep).join('/')}`;
      const size = readImageSize(full);
      found.push({
        src: rel,
        // The generator requires positive whole numbers, so an unreadable size
        // is omitted rather than guessed at.
        ...(size && size.width > 0 && size.height > 0 ? { w: size.width, h: size.height } : {})
      });
    }
  };

  if (fs.existsSync(imagesRoot)) walk(imagesRoot);
  found.sort((a, b) => a.src.localeCompare(b.src));
  return { images: found, count: found.length };
}

/* --------------------------------------------------------------- operations */

function list() {
  const data = read();
  const articles = data.ARTICLES.map((a) => ({ ...a }));
  const live = articles.filter((a) => isLive(a));
  return {
    categories: data.CATEGORIES,
    landingHero: { ...data.LANDING_HERO },
    articles: articles.map((article, index) => ({
      ...article,
      // position doubles as the stable handle for reordering in the admin UI.
      position: index + 1,
      publicUrl: `/pages/blog/${article.slug}.html`,
      isPublished: isLive(article)
    })),
    counts: {
      total: articles.length,
      published: live.length,
      drafts: articles.filter((a) => a.status === 'draft' && !a.deletedAt).length,
      deleted: articles.filter((a) => Boolean(a.deletedAt)).length,
      featured: live.filter((a) => a.featured === true).map((a) => a.slug)
    }
  };
}

function isLive(article) {
  return article.status !== 'draft' && !article.deletedAt;
}

function getBySlug(slug) {
  const data = read();
  const article = data.ARTICLES.find((a) => a.slug === slug);
  if (!article) throw ApiError.notFound(`No Journal article with slug "${slug}"`);
  return { ...article, isPublished: isLive(article), publicUrl: `/pages/blog/${slug}.html` };
}

/**
 * Apply a mutation and rebuild. `mutate` receives a private copy of the data and
 * returns the next version; nothing is written until it has passed validation.
 */
async function commit(mutate) {
  const current = read();
  const draft = {
    CATEGORIES: [...current.CATEGORIES],
    LANDING_HERO: { ...current.LANDING_HERO },
    ARTICLES: current.ARTICLES.map((a) => ({ ...a }))
  };

  const next = mutate(draft);
  assertInvariants(next.ARTICLES);

  const published = next.ARTICLES.filter(isLive);
  if (published.length === 0) {
    throw ApiError.badRequest(
      'At least one article must stay published. Unpublishing the last article would leave the Journal empty.'
    );
  }

  const backup = snapshot();
  try {
    writeDataFile(next);
  } catch (error) {
    restore(backup);
    throw ApiError.internal(`Could not save the Journal data file: ${error.message}`);
  }

  const build = await runBuild();

  if (build.failed || build.code !== 0) {
    restore(backup);
    const detail = (build.stderr || build.stdout || '').trim().split('\n').slice(-4).join(' ');
    throw new ApiError(
      500,
      'The Journal build failed, so nothing was saved and the previous version is back in place.',
      [{ field: 'build', message: detail || `generator exited with code ${build.code}` }]
    );
  }

  try {
    verifyOutput(published);
  } catch (error) {
    restore(backup);
    throw new ApiError(
      500,
      'The Journal was rebuilt but the result did not verify, so the previous version was restored.',
      [{ field: 'build', message: error.message }]
    );
  }

  return {
    build: { code: build.code, output: build.stdout.trim() },
    published: published.length,
    drafts: next.ARTICLES.filter((a) => a.status === 'draft' && !a.deletedAt).length
  };
}

async function create(input) {
  const data = read();
  if (data.ARTICLES.some((a) => a.slug === input.slug)) {
    throw ApiError.conflict(`Slug "${input.slug}" is already used`);
  }

  const result = await commit((next) => {
    const article = normaliseArticle(input);
    article.updatedAt = new Date().toISOString();

    // "Save as draft" from the new-article form lands here as status: 'draft'.
    // Anything else is published immediately.
    if (input.status === 'draft' || article.status === 'draft') {
      article.status = 'draft';
    } else {
      delete article.status;
      article.featured = null;
    }

    // New articles go to the top of the "Latest stories" list, below the
    // featured card, which is how the landing page orders them.
    const featuredAt = next.ARTICLES.findIndex((a) => a.featured === true);
    const at = featuredAt === -1 ? next.ARTICLES.length : featuredAt + 1;
    next.ARTICLES.splice(at, 0, article);
    return next;
  });

  return { ...getBySlug(input.slug), build: result.build, published: result.published };
}

async function update(slug, input) {
  const data = read();
  const existing = data.ARTICLES.find((a) => a.slug === slug);
  if (!existing) throw ApiError.notFound(`No Journal article with slug "${slug}"`);

  // A slug change moves a page that search engines already know about. It is
  // allowed, but only when the request confirms it, so a typo cannot quietly
  // break a published URL.
  const slugChanged = typeof input.slug === 'string' && input.slug.trim() !== slug;
  if (slugChanged && input.confirmSlugChange !== true) {
    throw new ApiError(409, `Changing the slug moves the published URL from /pages/blog/${slug}.html. Confirm the change to continue.`, [
      { field: 'confirmSlugChange', message: 'Set to true to move this article to a new URL' },
    ]);
  }

  if (slugChanged && data.ARTICLES.some((a) => a.slug === input.slug.trim())) {
    throw ApiError.conflict(`Slug "${input.slug.trim()}" is already used`);
  }

  const result = await commit((next) => {
    const index = next.ARTICLES.findIndex((a) => a.slug === slug);
    const current = next.ARTICLES[index];
    const merged = normaliseArticle(input, { existing: current });
    merged.updatedAt = new Date().toISOString();
    delete merged.slugChanged;
    next.ARTICLES[index] = merged;
    return next;
  });

  return {
    ...getBySlug(slugChanged ? input.slug.trim() : slug),
    build: result.build,
    published: result.published
  };
}

async function setPublished(slug, published) {
  const data = read();
  const existing = data.ARTICLES.find((a) => a.slug === slug);
  if (!existing) throw ApiError.notFound(`No Journal article with slug "${slug}"`);
  if (existing.deletedAt) {
    throw ApiError.badRequest('This article is deleted. Restore it before publishing.');
  }

  const result = await commit((next) => {
    const article = next.ARTICLES.find((a) => a.slug === slug);
    if (published) {
      delete article.status;
    } else {
      article.status = 'draft';
      // A draft cannot stay featured or the landing page would link to a page
      // that no longer exists.
      article.featured = null;
    }
    article.updatedAt = new Date().toISOString();
    return next;
  });

  return { ...getBySlug(slug), build: result.build, published: result.published };
}

async function setFeatured(slug) {
  const data = read();
  const existing = data.ARTICLES.find((a) => a.slug === slug);
  if (!existing) throw ApiError.notFound(`No Journal article with slug "${slug}"`);
  if (!isLive(existing)) {
    throw ApiError.badRequest('Only a published article can be featured.');
  }

  const result = await commit((next) => {
    next.ARTICLES.forEach((a) => {
      a.featured = a.slug === slug ? true : null;
    });
    next.ARTICLES.find((a) => a.slug === slug).updatedAt = new Date().toISOString();
    return next;
  });

  return { featured: slug, build: result.build, published: result.published };
}

async function remove(slug) {
  const data = read();
  const existing = data.ARTICLES.find((a) => a.slug === slug);
  if (!existing) throw ApiError.notFound(`No Journal article with slug "${slug}"`);
  if (!isLive(existing)) {
    throw ApiError.badRequest('This article is already unpublished or deleted.');
  }

  const result = await commit((next) => {
    const article = next.ARTICLES.find((a) => a.slug === slug);
    // Soft delete: the text is kept so the piece can be brought back, but it
    // leaves the public site immediately.
    article.deletedAt = new Date().toISOString();
    article.status = 'draft';
    article.featured = null;
    next.ARTICLES = next.ARTICLES.filter((a) => a.slug !== slug);
    const kept = { ...article };
    next.ARTICLES.unshift(kept);
    return next;
  });

  return { deleted: slug, restorable: true, build: result.build, published: result.published };
}

async function restoreArticle(slug) {
  const data = read();
  const existing = data.ARTICLES.find((a) => a.slug === slug);
  if (!existing) throw ApiError.notFound(`No Journal article with slug "${slug}"`);
  if (!existing.deletedAt) throw ApiError.badRequest('This article is not deleted.');

  const result = await commit((next) => {
    const article = next.ARTICLES.find((a) => a.slug === slug);
    delete article.deletedAt;
    delete article.status;
    return next;
  });

  return { restored: slug, build: result.build, published: result.published };
}

/**
 * Draft and deleted articles still need to be readable before they go live.
 * The markup comes from the generator itself, so a preview cannot drift from
 * the published page, and it is served only to an authenticated admin with
 * noindex set.
 */
function preview(slug) {
  const data = read();
  const article = data.ARTICLES.find((a) => a.slug === slug);
  if (!article) throw ApiError.notFound(`No Journal article with slug "${slug}"`);

  const builder = require('../scripts/buildJournal');
  return {
    html: builder.buildArticleHtml(article, { noindex: !isLive(article) }),
    isPublished: isLive(article),
    slug
  };
}

async function rebuild() {
  const build = await runBuild();
  if (build.failed || build.code !== 0) {
    const detail = (build.stderr || build.stdout || '').trim().split('\n').slice(-4).join(' ');
    throw new ApiError(500, 'The Journal build failed.', [
      { field: 'build', message: detail || `generator exited with code ${build.code}` },
    ]);
  }
  const data = read();
  verifyOutput(data.ARTICLES.filter(isLive));
  return { build: { code: build.code, output: build.stdout.trim() } };
}

module.exports = {
  DATA_FILE,
  LIMITS,
  BODY_TYPES,
  assertSlug,
  assertText,
  assertImage,
  assertBody,
  assertDate,
  assertReadingTime,
  normaliseArticle,
  assertInvariants,
  serialise,
  isLive,
  commit,
  list,
  listImages,
  getBySlug,
  create,
  update,
  setPublished,
  setFeatured,
  remove,
  restoreArticle,
  preview,
  rebuild,
  runBuild,
  snapshot,
  restore
};