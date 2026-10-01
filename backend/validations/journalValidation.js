/**
 * Request shapes for the admin Journal editor.
 *
 * These are deliberately thin: the authoritative rules (slug shape, image
 * paths, category membership, single featured article) live in journalService,
 * because they have to hold for the data file as a whole and not just for one
 * request. What is enforced here is the shape of the payload and the size caps,
 * so an oversized or wrongly typed body never reaches the file writer.
 */
const { z } = require('zod');

const journalService = require('../services/journalService');

const { LIMITS } = journalService;

/* The slug becomes a filename under public/pages/blog/ and a URL under
   /pages/blog/, so its shape is checked at the request boundary as well as in
   the service. Rejecting "../escape" here means a traversal attempt never gets
   as far as the file writer. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slug = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(LIMITS.slug, `Slug must be ${LIMITS.slug} characters or fewer`)
  .regex(
    SLUG_RE,
    'Slug may only use lowercase letters, numbers and single hyphens (for example: a-slow-morning)'
  );

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use the YYYY-MM-DD format');

const readingTime = z
  .string()
  .trim()
  .max(LIMITS.readingTime)
  .regex(/^\d+\s+min read$/i, 'Reading time must look like "6 min read"');

/* The same rule the service applies, restated so the editor gets an inline
   message instead of a generic validation failure. */
const imageSrc = z
  .string()
  .trim()
  .min(1, 'Image is required')
  .max(300)
  .refine(
    (value) => /^\/images\/[A-Za-z0-9._\-/]+$/.test(value) && !value.split('/').includes('..'),
    'Image must be a local path under /images/'
  );

const image = z.object({
  src: imageSrc,
  w: z.number().int().positive().max(10000),
  h: z.number().int().positive().max(10000),
  alt: z.string().trim().max(LIMITS.alt).optional().default(''),
  caption: z.string().trim().max(LIMITS.caption).optional().default('')
});

const bodyBlock = z.object({
  type: z.enum(['p', 'h2', 'quote']),
  text: z.string().trim().min(1, 'Content block text is required').max(LIMITS.blockText)
});

const inlineImages = z
  .array(image)
  .max(LIMITS.inlineImages, `At most ${LIMITS.inlineImages} inline images`)
  .optional()
  .default([]);

const body = z
  .array(bodyBlock)
  .min(1, 'An article needs at least one content block')
  .max(LIMITS.bodyBlocks, `At most ${LIMITS.bodyBlocks} content blocks`);

const articleFields = {
  slug,
  title: z.string().trim().min(1, 'Title is required').max(LIMITS.title),
  dek: z.string().trim().min(1, 'Standfirst is required').max(LIMITS.dek),
  category: z.string().trim().min(1, 'Category is required').max(LIMITS.category),
  date: isoDate,
  readingTime,
  excerpt: z.string().trim().min(1, 'Excerpt is required').max(LIMITS.excerpt),
  hero: image,
  inline: inlineImages,
  body
};

const createJournalArticleSchema = z.object({
  body: z
    .object({
      ...articleFields,
      featured: z.boolean().optional(),
      // "Save as draft" on the new-article form.
      status: z.enum(['published', 'draft']).optional().default('published')
    })
    .strict()
});

/* An update is partial: omitted fields keep the values already on disk, so the
   editor can save a one-line change without resending the whole article. */
const updateJournalArticleSchema = z.object({
  params: z.object({ slug }),
  body: z
    .object({
      ...articleFields,
      slug: slug.optional(),
      featured: z.boolean().optional(),
      // The service refuses a slug move unless this is explicitly true.
      confirmSlugChange: z.boolean().optional().default(false)
    })
    .partial()
    .strict()
});

const slugParamsSchema = z.object({
  params: z.object({ slug })
});

const publishSchema = z.object({
  params: z.object({ slug }),
  body: z.object({
    published: z.boolean({ required_error: 'published is required' })
  })
});

module.exports = {
  createJournalArticleSchema,
  updateJournalArticleSchema,
  slugParamsSchema,
  publishSchema
};