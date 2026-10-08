const query = require('../database/query');
const logAudit = require('../utils/auditLogger');
const {
  validateAmount,
  validateType,
  validateCategory,
  validateDate,
  validateFrequency,
} = require('../utils/validation');

exports.getAllRecurring = async (req, res, next) => {
  try {
    const rows = await query.all(
      'SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getRecurringById = async (req, res, next) => {
  try {
    const row = await query.get(
      'SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!row) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createRecurring = async (req, res, next) => {
  try {
    const { description, type, amount, category, frequency, nextOccurrence, isActive } = req.body;

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!validateType(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    if (!validateAmount(amount)) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!validateFrequency(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    if (!validateDate(nextOccurrence)) {
      return res.status(400).json({ error: 'Invalid next occurrence date (expected YYYY-MM-DD)' });
    }

    const result = await query.run(
      `INSERT INTO recurring_transactions (user_id, description, type, amount, category, frequency, next_occurrence, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, description.trim(), type, Number(amount), category, frequency, nextOccurrence, isActive ? 1 : 0]
    );

    logAudit(req.user.id, 'recurring_created', 'recurring', `Created recurring transaction #${result.lastID}`, req.ip);

    const row = await query.get('SELECT * FROM recurring_transactions WHERE id = ?', [result.lastID]);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateRecurring = async (req, res, next) => {
  try {
    const { description, type, amount, category, frequency, nextOccurrence, isActive } = req.body;

    const existing = await query.get(
      'SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!validateType(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    if (!validateAmount(amount)) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!validateFrequency(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    if (!validateDate(nextOccurrence)) {
      return res.status(400).json({ error: 'Invalid next occurrence date' });
    }

    await query.run(
      `UPDATE recurring_transactions
       SET description = ?, type = ?, amount = ?, category = ?, frequency = ?, next_occurrence = ?, is_active = ?
       WHERE id = ? AND user_id = ?`,
      [description.trim(), type, Number(amount), category, frequency, nextOccurrence, isActive ? 1 : 0, req.params.id, req.user.id]
    );

    logAudit(req.user.id, 'recurring_updated', 'recurring', `Updated recurring transaction #${req.params.id}`, req.ip);

    const updated = await query.get('SELECT * FROM recurring_transactions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteRecurring = async (req, res, next) => {
  try {
    const existing = await query.get(
      'SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }
    await query.run(
      'DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    logAudit(req.user.id, 'recurring_deleted', 'recurring', `Deleted recurring transaction #${req.params.id}`, req.ip);
    res.json({ message: 'Recurring transaction deleted successfully' });
  } catch (err) {
    next(err);
  }
};
