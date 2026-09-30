const express = require('express');
const router = express.Router();
const siteImageController = require('../controllers/siteImageController');

// Public and unauthenticated on purpose: the public site needs to know which
// image slots have been overridden so it can swap them at runtime. The payload
// contains nothing but image URLs.
router.get('/', siteImageController.getPublicOverrides);

// Serves image bytes stored in the database. Public because these are the
// site's own images, and the admin panel previews them through the same URLs.
// Content-Type comes from the validated upload, not from the request.
router.get('/file/:id', siteImageController.getStoredImage);

module.exports = router;
