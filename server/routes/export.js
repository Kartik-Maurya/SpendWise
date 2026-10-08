const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const requireAuth = require('../middleware/auth');

router.get('/csv', requireAuth, exportController.exportCSV);

module.exports = router;
