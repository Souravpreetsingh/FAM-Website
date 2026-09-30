const SiteImage = require('../models/SiteImage');
const cloudinaryService = require('./cloudinaryService');
const { PAGES, ALL_IMAGES, PAGE_BY_ID } = require('../config/siteImageRegistry');
const ApiError = require('../utils/ApiError');

const REGISTRY_KEYS = ALL_IMAGES.map((i) => i.key);

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
    if (url && !/^https:\/\//i.test(url)) {
      throw ApiError.badRequest('Image URL must start with https://');
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
  REGISTRY_KEYS,
};
