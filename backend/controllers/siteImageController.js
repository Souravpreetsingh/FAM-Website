const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const fs = require('fs');
const siteImageService = require('../services/siteImageService');
const imageStorage = require('../services/imageStorage');
const auditService = require('../services/auditService');

/**
 * Removes Multer's temporary upload file once its bytes are safely stored.
 * Best effort: a leftover temp file is untidy but not worth failing a
 * successful upload over.
 */
function discardUpload(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, () => {});
}

const getSiteImages = asyncHandler(async (req, res) => {
  const data = await siteImageService.listImages();
  ApiResponse.success(data, 'Site images loaded').send(res);
});

// Public, unauthenticated. Consumed by public/js/site-images.js. Kept tiny and
// heavily cacheable so it costs nothing on every page view.
const getPublicOverrides = asyncHandler(async (req, res) => {
  const data = await siteImageService.getOverrideMap();
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ success: true, data: data });
});

/**
 * Serves image bytes stored in MongoDB. Public, because these are the images
 * the public site itself displays. The Content-Type comes from the bytes that
 * were validated at upload time, never from anything the request supplies.
 */
const getStoredImage = asyncHandler(async (req, res) => {
  const found = await imageStorage.read(req.params.id);
  if (!found) {
    throw ApiError.notFound('That image no longer exists');
  }
  res.set('Content-Type', found.contentType);
  // The bytes behind an id never change, so they can be cached hard.
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  // Stops a browser second-guessing the Content-Type we detected at upload.
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', 'inline');
  // res.send derives Content-Length from the buffer. Setting it by hand as
  // well makes Express and Node disagree, which truncates the response and
  // leaves the browser with a half-decoded image.
  res.send(found.data);
});

const getLibrary = asyncHandler(async (req, res) => {
  const data = await imageStorage.listLibrary({
    cursor: req.query.cursor,
    limit: req.query.limit,
    folder: req.query.prefix,
  });
  ApiResponse.success(data, 'Library loaded').send(res);
});

const uploadImage = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await imageStorage.store(req.file, { folder: 'fam/site', user: req.user });
  } finally {
    // Multer stages the upload on disk first. Once the bytes are in MongoDB the
    // temporary file is dead weight, and on Render it would linger for the
    // lifetime of the instance. Unlink regardless of success or failure.
    discardUpload(req.file);
  }
  await auditService.log(req, {
    action: 'image.upload',
    entity: 'image',
    entityId: result.public_id,
    changes: { publicId: result.public_id, bytes: result.bytes, provider: result.provider },
  });
  ApiResponse.created(result, 'Image uploaded').send(res);
});

const updateImage = asyncHandler(async (req, res) => {
  const before = await siteImageService.getImage(req.params.key);
  const data = await siteImageService.setOverride(req.params.key, req.body || {}, req.user);
  await auditService.log(req, {
    action: before.isOverridden ? 'image.update' : 'image.set',
    entity: 'image',
    entityId: data.key,
    changes: { from: before.effectiveUrl, to: data.effectiveUrl, alt: data.alt },
  });
  ApiResponse.success(data, 'Image updated').send(res);
});

const revertImage = asyncHandler(async (req, res) => {
  const before = await siteImageService.getImage(req.params.key);
  const data = await siteImageService.revert(req.params.key);
  await auditService.log(req, {
    action: 'image.revert',
    entity: 'image',
    entityId: data.key,
    changes: { from: before.effectiveUrl, to: data.effectiveUrl },
  });
  ApiResponse.success(data, 'Image restored to the site default').send(res);
});

module.exports = {
  getSiteImages,
  getPublicOverrides,
  getStoredImage,
  getLibrary,
  uploadImage,
  updateImage,
  revertImage,
};
