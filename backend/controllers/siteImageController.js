const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const siteImageService = require('../services/siteImageService');
const cloudinaryService = require('../services/cloudinaryService');
const auditService = require('../services/auditService');

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

const getLibrary = asyncHandler(async (req, res) => {
  const data = await cloudinaryService.listLibrary({
    cursor: req.query.cursor,
    maxResults: req.query.limit,
    prefix: req.query.prefix,
  });
  ApiResponse.success(data, 'Library loaded').send(res);
});

const uploadImage = asyncHandler(async (req, res) => {
  const result = await cloudinaryService.uploadSiteImage(req.file);
  await auditService.log(req, {
    action: 'image.upload',
    entity: 'image',
    entityId: result.public_id,
    changes: { publicId: result.public_id, bytes: result.bytes },
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
  getLibrary,
  uploadImage,
  updateImage,
  revertImage,
};
