const db = require('../database/init');

function logAudit(userId, action, resource, detail, ipAddress) {
  const sql =
    'INSERT INTO audit_logs (user_id, action, resource, detail, ip_address) VALUES (?, ?, ?, ?, ?)';
  const params = [
    userId || null,
    action,
    resource || null,
    detail || null,
    ipAddress || null,
  ];
  db.run(sql, params, (err) => {
    if (err) {
      console.error('Failed to write audit log:', err.message);
    }
  });
}

module.exports = logAudit;
