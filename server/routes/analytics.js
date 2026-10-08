const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const requireAuth = require('../middleware/auth');

router.get('/spending-by-category', requireAuth, analyticsController.spendingByCategory);
router.get('/monthly-spending', requireAuth, analyticsController.monthlySpending);
router.get('/income-vs-expenses', requireAuth, analyticsController.incomeVsExpenses);
router.get('/summary', requireAuth, analyticsController.summary);

module.exports = router;
