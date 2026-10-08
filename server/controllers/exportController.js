function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

exports.exportCSV = async (req, res, next) => {
  try {
    const query = require('../database/query');
    const { decrypt } = require('../utils/encryption');

    const rows = await query.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      [req.user.id]
    );

    const header = ['Date', 'Type', 'Amount', 'Category', 'Description'];
    const lines = [header.join(',')];

    for (const row of rows) {
      let description = '';
      try {
        if (row.description_encrypted) {
          description = decrypt(row.description_encrypted) || '';
        } else if (row.description) {
          description = row.description;
        }
      } catch (err) {
        description = '';
      }

      const values = [
        row.date,
        row.type,
        Number(row.amount).toFixed(2),
        row.category,
        description,
      ];
      lines.push(values.map(csvEscape).join(','));
    }

    const csv = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="spendwise-transactions.csv"');
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
    res.send(csv);
  } catch (err) {
    next(err);
  }
};
