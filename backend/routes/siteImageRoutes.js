const express = require('express');
const router = express.Router();
const siteImageController = require('../controllers/siteImageController');

// Public and unauthenticated on purpose: the public site needs to know which
// image slots have been overridden so it can swap them at runtime. The payload
// contains nothing but image URLs.
router.get('/', siteImageController.getPublicOverrides);

module.exports = router;
