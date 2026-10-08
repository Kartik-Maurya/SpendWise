const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, auditController.getAuditLogs);

module.exports = router;
