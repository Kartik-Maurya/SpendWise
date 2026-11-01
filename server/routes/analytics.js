const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const requireAuth = require('../middleware/auth');

router.get('/spending-by-category', requireAuth, analyticsController.spendingByCategory);
router.get('/monthly-spending', requireAuth, analyticsController.monthlySpending);
router.get('/income-vs-expenses', requireAuth, analyticsController.incomeVsExpenses);
router.get('/summary', requireAuth, analyticsController.summary);

router.get('/overview', requireAuth, analyticsController.overview);
router.get('/insights', requireAuth, analyticsController.insights);
router.get('/recommendations', requireAuth, analyticsController.recommendations);
router.post('/recommendations/apply', requireAuth, analyticsController.applyRecommendations);
router.get('/backtest', requireAuth, analyticsController.backtest);
router.get('/plan', requireAuth, analyticsController.getPlan);
router.put('/plan', requireAuth, analyticsController.updatePlan);

module.exports = router;
