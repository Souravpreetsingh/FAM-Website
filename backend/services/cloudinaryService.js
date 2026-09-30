const { cloudinary } = require('../config/cloudinary');
const { cloudinaryStatus } = require('../config/cloudinaryStatus');
const ApiError = require('../utils/ApiError');

/**
 * Reject before the SDK does, with a message that names the actual problem.
 * The SDK's own error for an unset cloud name is "cloud_name is disabled",
 * which gives the owner no idea what to change.
 */
function assertCloudinaryUsable() {
  const status = cloudinaryStatus();
  if (status.ready) return;
  if (status.missing.length) {
    throw ApiError.internal('Cloudinary is not configured: missing ' + status.missing.join(', '));
  }
  throw ApiError.internal(
    'Cloudinary is not configured: ' + status.placeholder.join(', ') + ' still hold the placeholder value from .env.example'
  );
}

class CloudinaryService {
  async uploadImage(file, folder = 'fam/rooms') {
    if (!file) {
      throw ApiError.badRequest('No file provided');
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }

  async uploadImages(files, folder = 'fam/rooms') {
    if (!files || files.length === 0) {
      throw ApiError.badRequest('No files provided');
    }

    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return Promise.all(uploadPromises);
  }

  // Uploads a site image and returns the dimensions/format too, so the admin
  // Images view can show what was actually stored instead of guessing.
  async uploadSiteImage(file) {
    if (!file) {
      throw ApiError.badRequest('No file provided');
    }
    assertCloudinaryUsable();

    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'fam/site',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      resource_type: 'image',
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
      width: result.width || null,
      height: result.height || null,
      format: result.format || '',
      bytes: result.bytes || 0,
    };
  }

  // Browsable library for the "pick an existing image" flow. Returns raw
  // Cloudinary resources, newest first.
  async listLibrary({ cursor, maxResults, prefix } = {}) {
    assertCloudinaryUsable();

    const result = await cloudinary.api.resources({
      type: 'upload',
      direction: 'desc',
      max_results: Math.min(Number(maxResults) || 40, 100),
      next_cursor: cursor || undefined,
      prefix: prefix || 'fam/',
    });

    return {
      nextCursor: result.next_cursor || null,
      resources: (result.resources || []).map((r) => ({
        public_id: r.public_id,
        url: r.secure_url,
        width: r.width || null,
        height: r.height || null,
        format: r.format || '',
        bytes: r.bytes || 0,
        folder: r.folder || '',
        createdAt: r.created_at || null,
      })),
    };
  }

  async deleteImage(publicId) {
    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId);
  }

  async deleteImages(publicIds) {
    if (!publicIds || publicIds.length === 0) return;

    const deletePromises = publicIds.map((id) => this.deleteImage(id));
    await Promise.all(deletePromises);
  }
}

module.exports = new CloudinaryService();
