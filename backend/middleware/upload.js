const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // GIF is included because services/imageBytes can verify its header and the
  // admin library advertises it. This filter is only a cheap first pass; the
  // real decision is made from the bytes at upload time.
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only JPEG, PNG, WebP and GIF images are allowed'), false);
  }
};

// Single source of truth for the size cap, so the limit the admin panel shows
// is the limit the server enforces. models/StoredImage imports it from here.
const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_BYTES,
    files: 10,
  },
});

module.exports = upload;
module.exports.MAX_BYTES = MAX_BYTES;
