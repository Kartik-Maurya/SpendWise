const query = require('../database/query');

async function isSessionStale(userId, authenticatedAt) {
  const user = await query.get('SELECT password_changed_at FROM users WHERE id = ?', [userId]);
  if (!user) return true;
  if (!user.password_changed_at) return false;

  const changedAt = Date.parse(user.password_changed_at);
  if (Number.isNaN(changedAt)) return false;

  return changedAt > (Number(authenticatedAt) || 0);
}

module.exports = { isSessionStale };
