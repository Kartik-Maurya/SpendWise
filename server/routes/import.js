const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const requireAuth = require('../middleware/auth');

router.post('/preview', requireAuth, importController.previewImport);
router.post('/commit', requireAuth, importController.commitImport);

module.exports = router;
