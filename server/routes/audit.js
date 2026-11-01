const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, auditController.getAuditLogs);
router.get('/export', requireAuth, auditController.exportAuditLogs);
router.get('/recommendations', requireAuth, auditController.getRecommendationTrail);

module.exports = router;
