const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const requireAuth = require('../middleware/auth');

router.get('/csv', requireAuth, exportController.exportCSV);
router.get('/backup', requireAuth, exportController.exportBackup);
router.get('/workbook', requireAuth, exportController.exportWorkbook);
router.get('/report', requireAuth, exportController.exportMonthlyReport);

module.exports = router;
