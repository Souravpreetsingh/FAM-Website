/**
 * Admin endpoints for the static Journal.
 *
 * Each handler is thin on purpose: it turns a request into a journalService
 * call and logs what changed. All of the interesting rules (slug safety, the
 * single featured article, drafts staying off the public site, build and
 * rollback) live in the service so they hold no matter who calls it.
 */
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const journalService = require('../services/journalService');
const auditService = require('../services/auditService');

/* Article bodies are long, so an audit entry keeps the shape of the change
   rather than every word of it. */
function summarise(article) {
  if (!article) return {};
  return {
    slug: article.slug,
    title: article.title,
    category: article.category,
    date: article.date,
    status: article.status === 'draft' ? 'draft' : 'published',
    featured: article.featured === true,
    deleted: Boolean(article.deletedAt),
    blocks: Array.isArray(article.body) ? article.body.length : 0,
    inlineImages: Array.isArray(article.inline) ? article.inline.length : 0
  };
}

/** Everything about the Journal: articles, categories and counts. */
const getJournal = asyncHandler(async (req, res) => {
  ApiResponse.success(journalService.list(), 'Journal loaded').send(res);
});

/**
 * The images the picker may choose from. These are the files already on disk
 * under public/images, which is the only kind of src a Journal article accepts.
 */
const getJournalImages = asyncHandler(async (req, res) => {
  ApiResponse.success(journalService.listImages(), 'Images loaded').send(res);
});

const getJournalArticle = asyncHandler(async (req, res) => {
  const article = journalService.getBySlug(req.params.slug);
  ApiResponse.success(article, 'Article loaded').send(res);
});

const createArticle = asyncHandler(async (req, res) => {
  const article = await journalService.create(req.validated.body);
  await auditService.log(req, {
    action: 'journal.article.created',
    entity: 'journal',
    entityId: article.slug,
    changes: summarise(article)
  });
  ApiResponse.created(article, `Created "${article.title}" and rebuilt the Journal`).send(res);
});

const updateArticle = asyncHandler(async (req, res) => {
  const before = journalService.getBySlug(req.params.slug);
  const article = await journalService.update(req.params.slug, req.validated.body);
  await auditService.log(req, {
    action: 'journal.article.updated',
    entity: 'journal',
    entityId: article.slug,
    changes: { from: summarise(before), to: summarise(article) }
  });
  ApiResponse.success(article, `Saved "${article.title}" and rebuilt the Journal`).send(res);
});

const publishArticle = asyncHandler(async (req, res) => {
  const { published } = req.validated.body;
  const article = await journalService.setPublished(req.params.slug, published);
  await auditService.log(req, {
    action: published ? 'journal.article.published' : 'journal.article.unpublished',
    entity: 'journal',
    entityId: article.slug,
    changes: summarise(article)
  });
  ApiResponse.success(
    article,
    published
      ? `"${article.title}" is now live at ${article.publicUrl}`
      : `"${article.title}" was taken off the public site and kept as a draft`
  ).send(res);
});

const featureArticle = asyncHandler(async (req, res) => {
  const result = await journalService.setFeatured(req.params.slug);
  await auditService.log(req, {
    action: 'journal.article.featured',
    entity: 'journal',
    entityId: req.params.slug,
    changes: { featured: result.featured }
  });
  ApiResponse.success(result, `"${req.params.slug}" is now the featured story`).send(res);
});

const deleteArticle = asyncHandler(async (req, res) => {
  const result = await journalService.remove(req.params.slug);
  await auditService.log(req, {
    action: 'journal.article.deleted',
    entity: 'journal',
    entityId: req.params.slug,
    changes: { deleted: result.deleted, restorable: result.restorable }
  });
  ApiResponse.success(result, `"${req.params.slug}" was removed from the public site and can be restored`).send(res);
});

const restoreArticle = asyncHandler(async (req, res) => {
  const result = await journalService.restoreArticle(req.params.slug);
  await auditService.log(req, {
    action: 'journal.article.restored',
    entity: 'journal',
    entityId: req.params.slug,
    changes: { restored: result.restored }
  });
  ApiResponse.success(result, `"${req.params.slug}" is back on the public site`).send(res);
});

/**
 * Render one article without publishing it. The markup comes from the
 * generator itself, so a preview cannot drift from the real page.
 *
 * The route sits behind authenticate + authorizeAdmin, and the response is
 * marked noindex twice over: once in the markup and once in a header, because a
 * preview URL is the kind of thing that ends up pasted into a chat.
 */
const previewArticle = asyncHandler(async (req, res) => {
  const preview = journalService.preview(req.params.slug);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.set('Cache-Control', 'no-store, private');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(preview.html);
});

/** Re-run the generator on its own, for when the data file was edited by hand. */
const rebuildJournal = asyncHandler(async (req, res) => {
  const result = await journalService.rebuild();
  await auditService.log(req, {
    action: 'journal.rebuilt',
    entity: 'journal',
    changes: { code: result.build.code }
  });
  ApiResponse.success(result, 'Journal rebuilt from journalData.js').send(res);
});

module.exports = {
  getJournal,
  getJournalImages,
  getJournalArticle,
  createArticle,
  updateArticle,
  publishArticle,
  featureArticle,
  deleteArticle,
  restoreArticle,
  previewArticle,
  rebuildJournal,
  summarise
};