const query = require('../database/query');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const offset = (page - 1) * limit;

    const rows = await query.all(
      'SELECT id, action, resource, detail, ip_address, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, limit, offset]
    );

    const countRow = await query.get(
      'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total: countRow.count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};
