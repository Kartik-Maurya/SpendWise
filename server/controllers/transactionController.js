const query = require('../database/query');
const { encrypt, decrypt } = require('../utils/encryption');
const logAudit = require('../utils/auditLogger');
const { parseCsv } = require('../utils/csv');
const {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  validateAmount,
  validateType,
  validateCategory,
  validateDate,
} = require('../utils/validation');

const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const IMPORT_MAX_ROWS = 5000;
const IMPORT_ERROR_LIMIT = 50;
const BULK_MAX_IDS = 500;

const IMPORT_HEADER_ALIASES = {
  date: ['date', 'transaction date', 'txn date'],
  type: ['type', 'transaction type', 'txn type'],
  amount: ['amount', 'value', 'amount (inr)', 'amount inr'],
  category: ['category', 'head'],
  description: ['description', 'note', 'notes', 'memo', 'details'],
};

const IMPORT_TYPE_ALIASES = {
  income: 'income',
  credit: 'income',
  expense: 'expense',
  debit: 'expense',
};

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mapImportHeaders(headerRow) {
  const mapping = {};
  for (const [field, aliases] of Object.entries(IMPORT_HEADER_ALIASES)) {
    const index = headerRow.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
    if (index !== -1) mapping[field] = index;
  }
  return mapping;
}

function parseImportDate(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  let year;
  let month;
  let day;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseImportAmount(raw) {
  let value = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!value) return null;
  value = value
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/(₹|rs\.?|inr)$/i, '')
    .replace(/[\s,]/g, '');
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const amount = Number(value);
  if (!validateAmount(amount)) return null;
  return Math.round(amount * 100) / 100;
}

function resolveImportCategory(rawCategory, rawType, errors) {
  const raw = String(rawCategory || '').trim();
  const key = raw.toLowerCase();
  const typeKey = String(rawType || '').trim().toLowerCase();

  if (!raw) {
    errors.push('Category is required');
    return { type: null, category: null };
  }

  if (typeKey) {
    const type = IMPORT_TYPE_ALIASES[typeKey];
    if (!type) {
      errors.push('Type must be income, expense, credit or debit');
      return { type: null, category: null };
    }
    const pool = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const category = pool.find((item) => item.toLowerCase() === key);
    if (!category) {
      errors.push(`"${raw}" is not a ${type} category (${pool.join(', ')})`);
      return { type, category: null };
    }
    return { type, category };
  }

  const incomeCategory = INCOME_CATEGORIES.find((item) => item.toLowerCase() === key);
  if (incomeCategory) return { type: 'income', category: incomeCategory };

  const expenseCategory = EXPENSE_CATEGORIES.find((item) => item.toLowerCase() === key);
  if (expenseCategory) return { type: 'expense', category: expenseCategory };

  errors.push(
    `"${raw}" is not a known category (${[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].join(', ')})`
  );
  return { type: null, category: null };
}

function duplicateKey({ date, type, amount, category, description }) {
  return [
    date,
    type,
    Number(amount).toFixed(2),
    category,
    String(description || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase(),
  ].join('|');
}

function readImportedDescription(row) {
  try {
    if (row.description_encrypted) return decrypt(row.description_encrypted) || '';
    if (row.description) return row.description;
  } catch (err) {
    return '';
  }
  return '';
}

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

function categoryPoolFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function parseBulkIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Select at least one transaction' };
  }
  if (raw.length > BULK_MAX_IDS) {
    return { error: `A bulk action can include at most ${BULK_MAX_IDS} transactions` };
  }

  const ids = [];
  const seen = new Set();
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      return { error: 'Transaction ids must be positive integers' };
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return { ids };
}

function loadOwnedTransactionRows(ids, userId) {
  const placeholders = ids.map(() => '?').join(', ');
  return query.all(
    `SELECT id, type, category, date FROM transactions WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids]
  );
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

exports.bulkUpdateTransactions = async (req, res, next) => {
  let started = false;

  try {
    const body = req.body || {};
    const parsed = parseBulkIds(body.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const hasType = body.type !== undefined && body.type !== null && body.type !== '';
    const hasCategory = body.category !== undefined && body.category !== null && body.category !== '';
    const hasDate = body.date !== undefined && body.date !== null && body.date !== '';

    if (!hasType && !hasCategory && !hasDate) {
      return res.status(400).json({ error: 'Choose at least one field to update' });
    }
    if (hasType && !validateType(body.type)) {
      return res.status(400).json({ error: 'Invalid type. Must be income or expense' });
    }
    if (hasCategory && typeof body.category !== 'string') {
      return res.status(400).json({ error: 'Category must be a string' });
    }
    if (hasDate && !validateDate(body.date)) {
      return res.status(400).json({ error: 'Invalid date format (expected YYYY-MM-DD)' });
    }

    const ids = parsed.ids;
    const existing = await loadOwnedTransactionRows(ids, req.user.id);

    if (existing.length !== ids.length) {
      return res.status(404).json({ error: 'One or more transactions were not found' });
    }

    const conflicts = existing.filter((row) => {
      const targetType = hasType ? body.type : row.type;
      const targetCategory = hasCategory ? body.category : row.category;
      return !categoryPoolFor(targetType).includes(targetCategory);
    });

    if (conflicts.length > 0) {
      return res.status(400).json({
        error: `${conflicts.length} selected transaction(s) have a category that does not match the target type. Include a compatible category in the bulk edit.`,
      });
    }

    await query.run('BEGIN');
    started = true;

    for (const row of existing) {
      await query.run(
        'UPDATE transactions SET type = ?, category = ?, date = ? WHERE id = ? AND user_id = ?',
        [
          hasType ? body.type : row.type,
          hasCategory ? body.category : row.category,
          hasDate ? body.date : row.date,
          row.id,
          req.user.id,
        ]
      );
    }

    await query.run('COMMIT');
    started = false;

    const placeholders = ids.map(() => '?').join(', ');
    const updatedRows = await query.all(
      `SELECT * FROM transactions WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    );

    const fields = [hasType && 'type', hasCategory && 'category', hasDate && 'date']
      .filter(Boolean)
      .join(', ');
    logAudit(
      req.user.id,
      'transactions_bulk_updated',
      'transaction',
      `Bulk updated ${ids.length} transaction(s) ${ids.map((id) => `#${id}`).join(', ')}: ${fields}`,
      req.ip
    );

    res.json({ updated: ids.length, transactions: updatedRows.map(formatTransaction) });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[transactions] bulk update rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};

exports.bulkDeleteTransactions = async (req, res, next) => {
  let started = false;

  try {
    const body = req.body || {};
    const parsed = parseBulkIds(body.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const ids = parsed.ids;
    const existing = await loadOwnedTransactionRows(ids, req.user.id);

    if (existing.length !== ids.length) {
      return res.status(404).json({ error: 'One or more transactions were not found' });
    }

    await query.run('BEGIN');
    started = true;

    const placeholders = ids.map(() => '?').join(', ');
    await query.run(
      `DELETE FROM transactions WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    );

    await query.run('COMMIT');
    started = false;

    logAudit(
      req.user.id,
      'transactions_bulk_deleted',
      'transaction',
      `Bulk deleted ${ids.length} transaction(s) ${ids.map((id) => `#${id}`).join(', ')}`,
      req.ip
    );

    res.json({ deleted: ids.length });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[transactions] bulk delete rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};

exports.importTransactions = async (req, res, next) => {
  let started = false;

  try {
    const csv = req.body && req.body.csv;

    if (typeof csv !== 'string' || csv.trim() === '') {
      return res.status(400).json({ error: 'Provide the CSV file contents in the csv field' });
    }
    if (Buffer.byteLength(csv, 'utf8') > IMPORT_MAX_BYTES) {
      return res.status(413).json({ error: 'CSV files must be 2 MB or smaller' });
    }

    const parsed = parseCsv(csv);
    if (parsed.length < 2) {
      return res.status(400).json({ error: 'The CSV needs a header row and at least one transaction' });
    }

    const mapping = mapImportHeaders(parsed[0]);
    const missing = ['date', 'amount', 'category'].filter((field) => mapping[field] === undefined);
    if (missing.length) {
      return res.status(400).json({
        error: `Missing required column(s): ${missing.join(', ')}. Expected Date, Amount and Category.`,
      });
    }

    const dataRows = parsed.slice(1);
    if (dataRows.length > IMPORT_MAX_ROWS) {
      return res.status(413).json({
        error: `A single import can contain at most ${IMPORT_MAX_ROWS} transactions`,
      });
    }

    const cell = (row, field) =>
      mapping[field] === undefined ? '' : String(row[mapping[field]] ?? '').trim();

    const valid = [];
    const errors = [];

    dataRows.forEach((row, index) => {
      const line = index + 2;
      const rowErrors = [];

      const date = parseImportDate(cell(row, 'date'));
      if (!date) rowErrors.push('Date must be YYYY-MM-DD or DD/MM/YYYY');

      const amount = parseImportAmount(cell(row, 'amount'));
      if (amount === null) rowErrors.push('Amount must be a positive number');

      const { type, category } = resolveImportCategory(
        cell(row, 'category'),
        cell(row, 'type'),
        rowErrors
      );

      const description = cell(row, 'description');
      if (description.length > 500) rowErrors.push('Description must be 500 characters or fewer');

      if (rowErrors.length) {
        errors.push({ line, message: rowErrors.join('; ') });
        return;
      }

      valid.push({ line, date, amount, type, category, description });
    });

    const keys = new Set();
    let duplicateCount = 0;
    const duplicates = [];

    if (valid.length) {
      const dates = valid.map((item) => item.date).sort();
      const existing = await query.all(
        'SELECT date, type, amount, category, description, description_encrypted FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?',
        [req.user.id, dates[0], dates[dates.length - 1]]
      );

      for (const row of existing) {
        keys.add(
          duplicateKey({
            date: row.date,
            type: row.type,
            amount: row.amount,
            category: row.category,
            description: readImportedDescription(row),
          })
        );
      }
    }

    const toInsert = [];
    for (const item of valid) {
      const key = duplicateKey(item);
      if (keys.has(key)) {
        duplicateCount += 1;
        if (duplicates.length < 20) {
          duplicates.push({
            line: item.line,
            date: item.date,
            type: item.type,
            amount: item.amount,
            category: item.category,
            description: item.description,
          });
        }
        continue;
      }
      keys.add(key);
      toInsert.push(item);
    }

    if (toInsert.length) {
      await query.run('BEGIN');
      started = true;

      for (const item of toInsert) {
        await query.run(
          'INSERT INTO transactions (user_id, type, amount, category, description_encrypted, date) VALUES (?, ?, ?, ?, ?, ?)',
          [
            req.user.id,
            item.type,
            item.amount,
            item.category,
            encrypt(item.description || ''),
            item.date,
          ]
        );
      }

      await query.run('COMMIT');
      started = false;
    }

    logAudit(
      req.user.id,
      'transactions_imported',
      'transaction',
      `Imported ${toInsert.length} transaction(s) from CSV (${duplicateCount} duplicate(s) skipped, ${errors.length} row(s) rejected)`,
      req.ip
    );

    res.status(201).json({
      totalRows: dataRows.length,
      imported: toInsert.length,
      duplicates: duplicateCount,
      duplicateRows: duplicates,
      rejected: errors.length,
      errors: errors.slice(0, IMPORT_ERROR_LIMIT),
    });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[transactions] import rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};
