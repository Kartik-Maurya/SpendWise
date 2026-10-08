const { processDueRecurring } = require('../utils/recurringProcessor');

module.exports = async function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = { id: req.session.userId };
    try {
      await processDueRecurring(req.user.id);
    } catch (err) {
      console.error('[recurring] Error processing due recurring transactions:', err.message);
    }
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};
