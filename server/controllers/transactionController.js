const query = require('../database/query');
const { encrypt, decrypt } = require('../utils/encryption');
const logAudit = require('../utils/auditLogger');
const {
  validateAmount,
  validateType,
  validateCategory,
  validateDate,
} = require('../utils/validation');

function formatTransaction(row) {
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
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    amount: row.amount,
    category: row.category,
    description,
    date: row.date,
    created_at: row.created_at,
    recurring_id: row.recurring_id || null,
  };
}

function validateTransactionInput(body, isUpdate = false) {
  const errors = [];

  if (body.type && !validateType(body.type)) {
    errors.push('Invalid type. Must be income or expense');
  }
  if (isUpdate && !body.type) {
    errors.push('Type is required');
  }

  if (body.amount !== undefined && !validateAmount(body.amount)) {
    errors.push('Amount must be a positive number');
  }
  if (isUpdate && body.amount === undefined) {
    errors.push('Amount is required');
  }

  if (body.category !== undefined && body.type && !validateCategory(body.category, body.type)) {
    errors.push('Invalid category for the selected type');
  }

  if (isUpdate && !body.category) {
    errors.push('Category is required');
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be a string');
    } else if (body.description.length > 500) {
      errors.push('Description must be 500 characters or fewer');
    }
  }

  if (body.date && !validateDate(body.date)) {
    errors.push('Invalid date format (expected YYYY-MM-DD)');
  }
  if (isUpdate && !body.date) {
    errors.push('Date is required');
  }

  return errors;
}

exports.getAllTransactions = async (req, res, next) => {
  try {
    const { type, category, search, startDate, endDate, sortBy = 'date', sortOrder = 'desc' } = req.query;

    const allowedSort = ['date', 'amount', 'created_at', 'id'];
    const orderCol = allowedSort.includes(sortBy) ? sortBy : 'date';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [req.user.id];

    if (type && ['income', 'expense'].includes(type)) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }

    sql += ` ORDER BY ${orderCol} ${orderDir}`;

    const rows = await query.all(sql, params);
    let transactions = rows.map(formatTransaction);

    if (search) {
      const searchLower = String(search).toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(searchLower) ||
          t.category.toLowerCase().includes(searchLower)
      );
    }

    res.json(transactions);
  } catch (err) {
    next(err);
  }
};

exports.getTransactionById = async (req, res, next) => {
  try {
    const row = await query.get(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(formatTransaction(row));
  } catch (err) {
    next(err);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const incomeRow = await query.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = ?',
      [req.user.id, 'income']
    );
    const expenseRow = await query.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = ?',
      [req.user.id, 'expense']
    );
    const countRow = await query.get(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
      [req.user.id]
    );

    const income = incomeRow.total || 0;
    const expense = expenseRow.total || 0;

    res.json({
      income,
      expense,
      balance: income - expense,
      transactionCount: countRow.count || 0,
    });
  } catch (err) {
    next(err);
  }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const { type, amount, category, description, date } = req.body;

    const errors = validateTransactionInput(req.body, false);
    if (!type) errors.push('Type is required');

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const encryptedDesc = description ? encrypt(String(description)) : encrypt('');

    const result = await query.run(
      'INSERT INTO transactions (user_id, type, amount, category, description_encrypted, date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, type, Number(amount), category, encryptedDesc, date]
    );

    const row = await query.get('SELECT * FROM transactions WHERE id = ?', [result.lastID]);

    logAudit(req.user.id, 'transaction_created', 'transaction', `Created transaction #${result.lastID}`, req.ip);

    res.status(201).json(formatTransaction(row));
  } catch (err) {
    next(err);
  }
};

exports.updateTransaction = async (req, res, next) => {
  try {
    const { type, amount, category, description, date, recurring_id } = req.body;

    const errors = validateTransactionInput(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const existing = await query.get(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const encryptedDesc = description !== undefined ? encrypt(String(description)) : existing.description_encrypted;

    await query.run(
      'UPDATE transactions SET type = ?, amount = ?, category = ?, description_encrypted = ?, date = ?, recurring_id = ? WHERE id = ? AND user_id = ?',
      [type, Number(amount), category, encryptedDesc, date, recurring_id ?? null, req.params.id, req.user.id]
    );

    const updated = await query.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);

    logAudit(req.user.id, 'transaction_updated', 'transaction', `Updated transaction #${req.params.id}`, req.ip);

    res.json(formatTransaction(updated));
  } catch (err) {
    next(err);
  }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    const existing = await query.get(
      'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await query.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    logAudit(req.user.id, 'transaction_deleted', 'transaction', `Deleted transaction #${req.params.id}`, req.ip);

    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    next(err);
  }
};
