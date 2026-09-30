const mongoose = require('mongoose');

// One document per image slot on the public site. The set of documents is
// seeded from config/siteImageRegistry.js; a document only carries data when the
// owner has actually overridden the slot, so `url` empty means "keep using the
// hard-coded value in the page".
const siteImageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Key is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    page: {
      type: String,
      required: [true, 'Page is required'],
      trim: true,
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
    },
    kind: {
      type: String,
      enum: ['img', 'bg', 'poster', 'meta', 'link'],
      default: 'img',
    },
    // The value hard-coded in the page today. Kept so the admin view can show
    // the "original" and so a revert always has something to fall back to.
    fallback: {
      type: String,
      default: '',
    },
    // Owner-supplied replacement. Empty until overridden.
    url: {
      type: String,
      default: '',
    },
    publicId: {
      type: String,
      default: '',
    },
    // Optional alt-text override; empty means keep the alt already in the markup.
    alt: {
      type: String,
      default: '',
    },
    isOverridden: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedByEmail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

siteImageSchema.index({ page: 1 });
siteImageSchema.index({ isOverridden: 1 });

module.exports = mongoose.model('SiteImage', siteImageSchema);
