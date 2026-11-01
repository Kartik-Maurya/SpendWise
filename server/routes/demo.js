const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demoController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, demoController.getStatus);
router.post('/', requireAuth, demoController.load);
router.delete('/', requireAuth, demoController.purge);

module.exports = router;
