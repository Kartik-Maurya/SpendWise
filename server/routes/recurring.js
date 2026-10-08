const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, recurringController.getAllRecurring);
router.get('/:id', requireAuth, recurringController.getRecurringById);
router.post('/', requireAuth, recurringController.createRecurring);
router.put('/:id', requireAuth, recurringController.updateRecurring);
router.delete('/:id', requireAuth, recurringController.deleteRecurring);

module.exports = router;
