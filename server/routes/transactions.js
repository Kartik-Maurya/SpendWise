const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, transactionController.getAllTransactions);
router.get('/summary', requireAuth, transactionController.getSummary);
router.get('/:id', requireAuth, transactionController.getTransactionById);
router.post('/', requireAuth, transactionController.createTransaction);
router.put('/:id', requireAuth, transactionController.updateTransaction);
router.delete('/:id', requireAuth, transactionController.deleteTransaction);

module.exports = router;
