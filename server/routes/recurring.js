const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, recurringController.getAllRecurring);
router.patch('/bulk', requireAuth, recurringController.bulkUpdateRecurring);
router.post('/bulk-delete', requireAuth, recurringController.bulkDeleteRecurring);
router.post('/import', requireAuth, recurringController.importRecurring);
router.get('/:id', requireAuth, recurringController.getRecurringById);
router.post('/', requireAuth, recurringController.createRecurring);
router.put('/:id', requireAuth, recurringController.updateRecurring);
router.delete('/:id', requireAuth, recurringController.deleteRecurring);

module.exports = router;
