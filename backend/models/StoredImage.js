const mongoose = require('mongoose');

/**
 * Owner-uploaded image bytes, kept in MongoDB.
 *
 * This exists so the admin Images page works with no third-party account. The
 * alternative, writing to the container's disk, is not viable: Render's free
 * instances have an ephemeral filesystem, so every deploy or restart would
 * silently drop uploaded files and quietly restore the site's original images.
 * MongoDB is already connected to and survives deploys.
 *
 * Trade-off to be aware of: the bytes live in the same Atlas cluster as the
 * rest of the app, and MongoDB caps a document at 16MB, so uploads are held to
 * MAX_BYTES below. That is fine for a site this size, but a CDN such as
 * Cloudinary is the better answer once the image count grows.
 */

// BSON documents must stay under 16MB. Leaves room for the rest of the
// document so an upload near the limit still saves.
//
// Imported rather than restated, so the cap the admin panel advertises and the
// cap multer enforces can never drift apart. When they disagree, the panel
// promises a limit the server refuses and the upload fails with an error the
// user cannot act on.
const MAX_BYTES = require('../middleware/upload').MAX_BYTES;

const storedImageSchema = new mongoose.Schema(
  {
    // Bytes as uploaded, after the format check in services/imageBytes.
    data: {
      type: Buffer,
      required: true,
    },
    // Always the type detected from the bytes, never the browser-supplied
    // mimetype, so a renamed .html cannot be served back as text/html.
    contentType: {
      type: String,
      required: true,
    },
    ext: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    originalName: {
      type: String,
      default: '',
      trim: true,
    },
    // "fam/site" for the Images page, "fam/rooms" for room uploads.
    folder: {
      type: String,
      default: 'fam/site',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    uploadedByEmail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

storedImageSchema.index({ folder: 1, createdAt: -1 });

module.exports = mongoose.model('StoredImage', storedImageSchema);
module.exports.MAX_BYTES = MAX_BYTES;
