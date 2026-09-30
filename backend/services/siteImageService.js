const SiteImage = require('../models/SiteImage');
const { PAGES, ALL_IMAGES, PAGE_BY_ID } = require('../config/siteImageRegistry');
const ApiError = require('../utils/ApiError');
const imageStorage = require('./imageStorage');

const REGISTRY_KEYS = ALL_IMAGES.map((i) => i.key);

// Images live in one of two places, and both are known-good by construction:
//   - our own storage route, for uploads kept in MongoDB
//   - an https:// address, for a CDN such as Cloudinary
// Nothing else is accepted, so a caller cannot smuggle in javascript:, data:
// or a protocol-relative //host reference.
const OWN_STORAGE_PATH = /^\/api\/v1\/site-images\/file\/[a-f0-9]{24}$/i;

function isAcceptableImageUrl(url) {
  return /^https:\/\//i.test(url) || OWN_STORAGE_PATH.test(url);
}

// Keeps the collection in step with the registry without ever clobbering an
// owner's override: url/publicId/alt/isOverridden are left alone, only the
// descriptive fields are refreshed from code. Runs on every boot, so adding a
// new image slot to the registry is all that is needed to surface it in admin.
async function syncRegistry() {
  const ops = ALL_IMAGES.map((entry) => ({
    updateOne: {
      filter: { key: entry.key },
      update: {
        $set: {
          page: entry.page,
          label: entry.label,
          kind: entry.kind,
          fallback: entry.fallback,
        },
        $setOnInsert: {
          url: '',
          publicId: '',
          alt: entry.alt || '',
          isOverridden: false,
        },
      },
      upsert: true,
    },
  }));

  const res = await SiteImage.bulkWrite(ops, { ordered: false });

  // Keys are permanent, but if one is ever removed from the registry its
  // override becomes unreachable, so drop the orphan rather than hide it.
  const orphans = await SiteImage.find({ key: { $nin: REGISTRY_KEYS } }).select('key');
  if (orphans.length) {
    await SiteImage.deleteMany({ key: { $in: orphans.map((o) => o.key) } });
    console.warn('[siteImages] removed ' + orphans.length + ' orphaned override(s)');
  }

  return {
    upserted: (res.upsertedCount || 0) + (res.modifiedCount || 0),
    total: REGISTRY_KEYS.length,
  };
}

function decorate(doc) {
  return {
    key: doc.key,
    page: doc.page,
    pageTitle: (PAGE_BY_ID[doc.page] || {}).title || doc.page,
    label: doc.label,
    kind: doc.kind,
    fallback: doc.fallback || '',
    url: doc.url || '',
    publicId: doc.publicId || '',
    alt: doc.alt || '',
    isOverridden: !!doc.isOverridden,
    effectiveUrl: doc.isOverridden && doc.url ? doc.url : doc.fallback || '',
    updatedAt: doc.updatedAt || null,
    updatedByEmail: doc.updatedByEmail || '',
  };
}

async function listImages() {
  const docs = await SiteImage.find({ key: { $in: REGISTRY_KEYS } });
  const byKey = docs.reduce((acc, d) => {
    acc[d.key] = d;
    return acc;
  }, {});

  const images = REGISTRY_KEYS.map((key) => {
    const doc = byKey[key];
    if (doc) return decorate(doc);
    const entry = ALL_IMAGES.find((i) => i.key === key);
    return {
      key,
      page: entry.page,
      pageTitle: entry.page,
      label: entry.label,
      kind: entry.kind,
      fallback: entry.fallback,
      url: '',
      publicId: '',
      alt: entry.alt || '',
      isOverridden: false,
      effectiveUrl: entry.fallback,
      updatedAt: null,
      updatedByEmail: '',
    };
  });

  return {
    pages: PAGES.map((p) => ({ id: p.id, title: p.title, count: images.filter((i) => i.page === p.id).length })),
    // What uploads can currently do, so the admin UI can say so up front rather
    // than letting the owner pick a file and only then hit a failure. With the
    // default provider this is always usable, because images go to MongoDB.
    storage: imageStorage.status(),
    images: images,
  };
}

async function getImage(key) {
  const doc = await SiteImage.findOne({ key: String(key || '').toLowerCase().trim() });
  if (!doc) throw ApiError.notFound('Unknown image key: ' + key);
  return decorate(doc);
}

function assertKey(key) {
  if (REGISTRY_KEYS.indexOf(key) === -1) {
    throw ApiError.badRequest('Unknown image key: ' + key);
  }
}

async function setOverride(key, payload, admin) {
  const normalized = String(key || '').toLowerCase().trim();
  assertKey(normalized);

  const doc = await SiteImage.findOne({ key: normalized });
  if (!doc) throw ApiError.notFound('Unknown image key: ' + key);

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'url')) {
    const url = String(payload.url || '').trim();
    if (url && !isAcceptableImageUrl(url)) {
      throw ApiError.badRequest(
        'That image address is not allowed. Use the uploaded image, or an https:// address.'
      );
    }
    patch.url = url;
    patch.publicId = String(payload.publicId || '').trim();
    patch.isOverridden = !!url;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'alt')) {
    patch.alt = String(payload.alt || '').slice(0, 300);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'label')) {
    patch.label = String(payload.label || doc.label).slice(0, 160);
  }

  Object.assign(doc, patch);
  doc.updatedBy = admin ? admin._id : null;
  doc.updatedByEmail = admin ? admin.email || '' : '';
  await doc.save();

  return decorate(doc);
}

async function revert(key) {
  const normalized = String(key || '').toLowerCase().trim();
  assertKey(normalized);

  const doc = await SiteImage.findOne({ key: normalized });
  if (!doc) throw ApiError.notFound('Unknown image key: ' + key);

  // The previous Cloudinary asset is intentionally left in place: the same
  // upload may be reused by another slot, and destroying it would break that.
  doc.url = '';
  doc.publicId = '';
  doc.isOverridden = false;
  await doc.save();

  return decorate(doc);
}

// Shape consumed by the public loader: only slots that are actually overridden
// are sent, so an empty map means "render every page exactly as it is in code".
async function getOverrideMap() {
  const docs = await SiteImage.find({ isOverridden: true }).select('key url alt');
  const urls = {};
  const alts = {};
  docs.forEach((d) => {
    if (!d.url) return;
    urls[d.key] = d.url;
    if (d.alt) alts[d.key] = d.alt;
  });
  return { urls, alts };
}

module.exports = {
  syncRegistry,
  listImages,
  getImage,
  setOverride,
  revert,
  getOverrideMap,
  isAcceptableImageUrl,
  REGISTRY_KEYS,
};
