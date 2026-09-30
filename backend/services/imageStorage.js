const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const StoredImage = require('../models/StoredImage');
const ApiError = require('../utils/ApiError');
const { detectImage, supportedTypes } = require('./imageBytes');
const { cloudinaryStatus } = require('../config/cloudinaryStatus');

/**
 * Where uploaded images are kept, behind one interface.
 *
 * Two providers:
 *   mongodb   stores the bytes in the Atlas cluster already connected to this
 *             app. Needs no account, so it is the default and it is what makes
 *             the admin Images page usable out of the box.
 *   cloudinary  offloads to a CDN, which scales better for a large image
 *             library, but needs a Cloudinary account.
 *
 * The provider is chosen by IMAGE_STORAGE. It defaults to mongodb, and is
 * pinned there unless cloudinary is explicitly requested AND actually
 * configured, so behaviour does not shift underneath a deployment just because
 * a credential appeared.
 */

const PROVIDERS = ['mongodb', 'cloudinary'];

function requestedProvider(env = process.env) {
  const wanted = String(env.IMAGE_STORAGE || '').trim().toLowerCase();
  if (!wanted) return 'mongodb';
  if (!PROVIDERS.includes(wanted)) return 'mongodb';
  return wanted;
}

function activeProvider(env = process.env) {
  const wanted = requestedProvider(env);
  if (wanted === 'cloudinary' && cloudinaryStatus(env).ready) return 'cloudinary';
  return 'mongodb';
}

/** The public URL for a stored image. Relative, so it works on any host. */
function publicUrl(id) {
  return '/api/v1/site-images/file/' + String(id);
}

/**
 * What the admin panel needs to know about uploads before it offers them.
 * @returns {{provider: string, ready: boolean, accepts: string[], maxBytes: number,
 *            detail: string|null}}
 */
function status(env = process.env) {
  const provider = activeProvider(env);
  const cloud = cloudinaryStatus(env);

  if (provider === 'cloudinary') {
    return {
      provider: 'cloudinary',
      ready: true,
      accepts: supportedTypes(),
      maxBytes: StoredImage.MAX_BYTES,
      detail: null,
    };
  }

  // MongoDB can only be as available as the connection it writes to, which is
  // not knowable without a round trip, so this reports configuration only.
  const detail = requestedProvider(env) === 'cloudinary'
    ? 'IMAGE_STORAGE is set to cloudinary but the Cloudinary credentials are not usable, so images are being stored in the database instead. ' +
      (cloud.placeholder.length
        ? cloud.placeholder.join(', ') + ' still hold the placeholder value from the example file.'
        : 'Missing: ' + (cloud.missing.join(', ') || 'unknown') + '.')
    : null;

  return {
    provider: 'mongodb',
    ready: mongoose.connection.readyState === 1,
    accepts: supportedTypes(),
    maxBytes: StoredImage.MAX_BYTES,
    detail,
  };
}

function assertUsable() {
  if (mongoose.connection.readyState !== 1) {
    throw ApiError.internal('The database is not connected, so images cannot be stored right now. Try again in a moment.');
  }
}

/**
 * Validates and stores an uploaded file.
 *
 * @param {{path?: string, buffer?: Buffer, originalname?: string, mimetype?: string}} file
 * @returns {Promise<{public_id: string, url: string, width: number|null,
 *                    height: number|null, format: string, bytes: number,
 *                    provider: string, contentType: string}>}
 */
async function store(file, { folder = 'fam/site', user = null } = {}) {
  if (!file) throw ApiError.badRequest('No file provided');

  const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
  if (!buffer || !buffer.length) throw ApiError.badRequest('That file was empty');

  if (buffer.length > StoredImage.MAX_BYTES) {
    throw ApiError.badRequest(
      'That image is ' + Math.round(buffer.length / (1024 * 1024)) + 'MB. The limit is ' +
      Math.round(StoredImage.MAX_BYTES / (1024 * 1024)) + 'MB. Please compress it or resize it and try again.'
    );
  }

  // The declared mimetype is not trusted; the bytes decide.
  const detected = detectImage(buffer);
  if (!detected) {
    throw ApiError.badRequest(
      'That file is not a readable image. Please upload a JPEG, PNG, WebP or GIF. ' +
      'If it looks right on your computer, try exporting it again.'
    );
  }

  const provider = activeProvider();

  if (provider === 'cloudinary') {
    // Delegated so the same call site covers both providers.
    const cloudinaryService = require('./cloudinaryService');
    const result = await cloudinaryService.uploadSiteImage(file);
    return Object.assign({ provider: 'cloudinary', contentType: detected.type }, result);
  }

  assertUsable();

  const doc = await StoredImage.create({
    data: buffer,
    contentType: detected.type,
    ext: require('./imageBytes').extensionFor(detected.type),
    size: buffer.length,
    width: detected.width,
    height: detected.height,
    originalName: path.basename(String(file.originalname || '')).slice(0, 180),
    folder,
    uploadedBy: user && user._id ? user._id : null,
    uploadedByEmail: user && user.email ? user.email : '',
  });

  return {
    public_id: String(doc._id),
    url: publicUrl(doc._id),
    width: doc.width,
    height: doc.height,
    format: doc.ext,
    bytes: doc.size,
    provider: 'mongodb',
    contentType: doc.contentType,
  };
}

/**
 * Browsable library for the "pick an existing image" flow, newest first.
 * Same shape as the Cloudinary listing so the admin UI works with either.
 */
async function listLibrary({ cursor, limit, folder } = {}) {
  const provider = activeProvider();

  if (provider === 'cloudinary') {
    const cloudinaryService = require('./cloudinaryService');
    const out = await cloudinaryService.listLibrary({ cursor, maxResults: limit, prefix: folder });
    return {
      provider: 'cloudinary',
      nextCursor: out.nextCursor,
      resources: out.resources.map((r) => Object.assign({ provider: 'cloudinary' }, r)),
    };
  }

  assertUsable();

  const take = Math.min(Number(limit) || 40, 100);
  const query = {};
  if (folder) query.folder = folder;

  // Opaque cursor: the createdAt of the last item on the previous page.
  let after = null;
  if (cursor) {
    const d = new Date(String(cursor));
    if (!isNaN(d.getTime())) after = d;
  }

  const filter = Object.assign({}, query);
  if (after) filter.createdAt = { $lt: after };

  const docs = await StoredImage.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(take + 1)
    .select('-data')
    .lean();

  const hasMore = docs.length > take;
  const page = hasMore ? docs.slice(0, take) : docs;
  const last = page[page.length - 1];

  return {
    provider: 'mongodb',
    nextCursor: hasMore && last ? new Date(last.createdAt).toISOString() : null,
    resources: page.map((d) => ({
      public_id: String(d._id),
      url: publicUrl(d._id),
      width: d.width,
      height: d.height,
      format: d.ext,
      bytes: d.size,
      folder: d.folder,
      contentType: d.contentType,
      originalName: d.originalName,
      createdAt: d.createdAt,
      provider: 'mongodb',
    })),
  };
}

/**
 * Coerces a stored image value to a native Buffer.
 *
 * This is not paranoia. Mongoose returns different things depending on how the
 * document is fetched: a hydrated document gives a real Buffer, while .lean()
 * and the raw driver give a BSON Binary whose payload sits on .buffer. Feeding
 * a Binary to Buffer.from() does not throw, it returns a ZERO-LENGTH buffer,
 * so the response would be a 200 with an empty body and a browser showing a
 * broken image. Silent and hard to spot, hence the explicit conversion.
 */
function toNativeBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (Buffer.isBuffer(value.buffer)) return value.buffer;
  if (typeof value.length === 'number' && value.length > 0) {
    const copy = Buffer.alloc(value.length);
    if (typeof value.copy === 'function') value.copy(copy);
    return copy;
  }
  return null;
}

/**
 * Reads the bytes for a stored image, for the serving route.
 * @returns {Promise<{data: Buffer, contentType: string, size: number}|null>}
 */
async function read(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  // Hydrated rather than .lean(), so data arrives as a native Buffer.
  const doc = await StoredImage.findById(id);
  if (!doc || !doc.data) return null;
  const data = toNativeBuffer(doc.data);
  if (!data || !data.length) return null;
  return { data, contentType: doc.contentType, size: doc.size || data.length };
}

module.exports = { store, listLibrary, read, status, publicUrl, activeProvider, requestedProvider, toNativeBuffer, PROVIDERS, MAX_BYTES: StoredImage.MAX_BYTES };
