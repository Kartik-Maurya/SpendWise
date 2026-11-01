const { processDueRecurring } = require('../utils/recurringProcessor');
const { isSessionStale } = require('../utils/sessions');

module.exports = async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    if (await isSessionStale(req.session.userId, req.session.authenticatedAt)) {
      return req.session.destroy(() =>
        res.status(401).json({ error: 'Session expired. Please log in again.' })
      );
    }
  } catch (err) {
    return next(err);
  }

  req.user = { id: req.session.userId };

  try {
    await processDueRecurring(req.user.id);
  } catch (err) {
    console.error('[recurring] Error processing due recurring transactions:', err.message);
  }

  next();
};
