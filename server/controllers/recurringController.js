const query = require('../database/query');
const logAudit = require('../utils/auditLogger');
const { encrypt, decrypt } = require('../utils/encryption');
const { parseCsv } = require('../utils/csv');
const {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_ERROR_LIMIT,
  mapHeaders,
  parseImportDate,
  parseImportAmount,
  unguardFormula,
  isMaskedValue,
} = require('../utils/importHelpers');
const {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  validateAmount,
  validateType,
  validateCategory,
  validateDate,
  validateFrequency,
} = require('../utils/validation');

const BULK_MAX_IDS = 500;

const IMPORT_HEADER_ALIASES = {
  type: ['type', 'transaction type'],
  amount: ['amount', 'value', 'amount (inr)', 'amount inr'],
  category: ['category', 'head'],
  description: ['description', 'note', 'notes', 'memo', 'details', 'name'],
  frequency: ['frequency', 'recurrence', 'schedule'],
  nextOccurrence: ['next occurrence', 'next date', 'next occurrence date', 'next_occurrence'],
  status: ['status', 'state', 'active'],
};

const IMPORT_STATUS_ALIASES = {
  active: 1,
  yes: 1,
  true: 1,
  '1': 1,
  paused: 0,
  inactive: 0,
  no: 0,
  false: 0,
  '0': 0,
};

function recurringDuplicateKey({ type, amount, category, description, frequency, nextOccurrence, isActive }) {
  return [
    type,
    Number(amount).toFixed(2),
    category,
    String(description || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase(),
    frequency,
    nextOccurrence,
    isActive ? 1 : 0,
  ].join('|');
}

function categoryPoolFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function parseBulkIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Select at least one recurring transaction' };
  if (raw.length > BULK_MAX_IDS) {
    return { error: `A bulk action can include at most ${BULK_MAX_IDS} recurring transactions` };
  }
  const ids = [];
  const seen = new Set();
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return { error: 'Recurring transaction ids must be positive integers' };
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids };
}

function loadOwnedRecurringRows(ids, userId) {
  const placeholders = ids.map(() => '?').join(', ');
  return query.all(
    `SELECT id, type, category, next_occurrence FROM recurring_transactions WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids]
  );
}

function serialize(row) {
  if (!row) return row;
  let description = '';
  if (row.description_encrypted) {
    try {
      description = decrypt(row.description_encrypted) || '';
    } catch (err) {
      description = '';
    }
  } else if (row.description) {
    description = row.description;
  }
  const { description_encrypted, ...rest } = row;
  return { ...rest, description };
}

exports.getAllRecurring = async (req, res, next) => {
  try {
    const rows = await query.all(
      'SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows.map(serialize));
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
    res.json(serialize(row));
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
      `INSERT INTO recurring_transactions (user_id, description, description_encrypted, type, amount, category, frequency, next_occurrence, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        '',
        encrypt(description.trim()),
        type,
        Number(amount),
        category,
        frequency,
        nextOccurrence,
        isActive ? 1 : 0,
      ]
    );

    logAudit(req.user.id, 'recurring_created', 'recurring', `Created recurring transaction #${result.lastID}`, req.ip);

    const row = await query.get('SELECT * FROM recurring_transactions WHERE id = ?', [result.lastID]);
    res.status(201).json(serialize(row));
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
       SET description = '', description_encrypted = ?, type = ?, amount = ?, category = ?, frequency = ?, next_occurrence = ?, is_active = ?
       WHERE id = ? AND user_id = ?`,
      [
        encrypt(description.trim()),
        type,
        Number(amount),
        category,
        frequency,
        nextOccurrence,
        isActive ? 1 : 0,
        req.params.id,
        req.user.id,
      ]
    );

    logAudit(req.user.id, 'recurring_updated', 'recurring', `Updated recurring transaction #${req.params.id}`, req.ip);

    const updated = await query.get('SELECT * FROM recurring_transactions WHERE id = ?', [req.params.id]);
    res.json(serialize(updated));
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

exports.bulkUpdateRecurring = async (req, res, next) => {
  let started = false;

  try {
    const body = req.body || {};
    const parsed = parseBulkIds(body.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const hasType = body.type !== undefined && body.type !== null && body.type !== '';
    const hasCategory = body.category !== undefined && body.category !== null && body.category !== '';
    const hasNext = body.nextOccurrence !== undefined && body.nextOccurrence !== null && body.nextOccurrence !== '';

    if (!hasType && !hasCategory && !hasNext) {
      return res.status(400).json({ error: 'Choose at least one field to update' });
    }
    if (hasType && !validateType(body.type)) {
      return res.status(400).json({ error: 'Invalid type. Must be income or expense' });
    }
    if (hasCategory && typeof body.category !== 'string') {
      return res.status(400).json({ error: 'Category must be a string' });
    }
    if (hasNext && !validateDate(body.nextOccurrence)) {
      return res.status(400).json({ error: 'Invalid next occurrence date (expected YYYY-MM-DD)' });
    }

    const ids = parsed.ids;
    const existing = await loadOwnedRecurringRows(ids, req.user.id);

    if (existing.length !== ids.length) {
      return res.status(404).json({ error: 'One or more recurring transactions were not found' });
    }

    const conflicts = existing.filter((row) => {
      const targetType = hasType ? body.type : row.type;
      const targetCategory = hasCategory ? body.category : row.category;
      return !categoryPoolFor(targetType).includes(targetCategory);
    });

    if (conflicts.length > 0) {
      return res.status(400).json({
        error: `${conflicts.length} selected recurring transaction(s) have a category that does not match the target type. Include a compatible category in the bulk edit.`,
      });
    }

    await query.run('BEGIN');
    started = true;

    for (const row of existing) {
      await query.run(
        'UPDATE recurring_transactions SET type = ?, category = ?, next_occurrence = ? WHERE id = ? AND user_id = ?',
        [
          hasType ? body.type : row.type,
          hasCategory ? body.category : row.category,
          hasNext ? body.nextOccurrence : row.next_occurrence,
          row.id,
          req.user.id,
        ]
      );
    }

    await query.run('COMMIT');
    started = false;

    const placeholders = ids.map(() => '?').join(', ');
    const updatedRows = await query.all(
      `SELECT * FROM recurring_transactions WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    );

    const fields = [hasType && 'type', hasCategory && 'category', hasNext && 'next occurrence']
      .filter(Boolean)
      .join(', ');
    logAudit(
      req.user.id,
      'recurring_bulk_updated',
      'recurring',
      `Bulk updated ${ids.length} recurring transaction(s) ${ids.map((id) => `#${id}`).join(', ')}: ${fields}`,
      req.ip
    );

    res.json({ updated: ids.length, recurring: updatedRows.map(serialize) });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[recurring] bulk update rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};

exports.bulkDeleteRecurring = async (req, res, next) => {
  let started = false;

  try {
    const body = req.body || {};
    const parsed = parseBulkIds(body.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const ids = parsed.ids;
    const existing = await loadOwnedRecurringRows(ids, req.user.id);

    if (existing.length !== ids.length) {
      return res.status(404).json({ error: 'One or more recurring transactions were not found' });
    }

    await query.run('BEGIN');
    started = true;

    const placeholders = ids.map(() => '?').join(', ');
    await query.run(
      `DELETE FROM recurring_transactions WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...ids]
    );

    await query.run('COMMIT');
    started = false;

    logAudit(
      req.user.id,
      'recurring_bulk_deleted',
      'recurring',
      `Bulk deleted ${ids.length} recurring transaction(s) ${ids.map((id) => `#${id}`).join(', ')}`,
      req.ip
    );

    res.json({ deleted: ids.length });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[recurring] bulk delete rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};

exports.importRecurring = async (req, res, next) => {
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
      return res.status(400).json({ error: 'The CSV needs a header row and at least one recurring schedule' });
    }

    const mapping = mapHeaders(parsed[0], IMPORT_HEADER_ALIASES);
    const missing = ['type', 'amount', 'category', 'description', 'frequency', 'nextOccurrence'].filter(
      (field) => mapping[field] === undefined
    );
    if (missing.length) {
      return res.status(400).json({
        error: `Missing required column(s): ${missing.join(', ')}. Expected Type, Amount, Category, Description, Frequency and Next Occurrence.`,
      });
    }

    const dataRows = parsed.slice(1);
    if (dataRows.length > IMPORT_MAX_ROWS) {
      return res.status(413).json({
        error: `A single import can contain at most ${IMPORT_MAX_ROWS} recurring schedules`,
      });
    }

    const cell = (row, field) =>
      mapping[field] === undefined ? '' : String(row[mapping[field]] ?? '').trim();

    const valid = [];
    const errors = [];

    dataRows.forEach((row, index) => {
      const line = index + 2;
      const rowErrors = [];

      const type = cell(row, 'type').toLowerCase();
      if (!validateType(type)) rowErrors.push('Type must be income or expense');

      const rawAmount = cell(row, 'amount');
      const amount = parseImportAmount(rawAmount);
      if (amount === null) {
        rowErrors.push(
          isMaskedValue(rawAmount)
            ? 'Masked exports cannot be imported. Download without privacy mode first'
            : 'Amount must be a positive number'
        );
      }

      const rawCategory = unguardFormula(cell(row, 'category'));
      let category = null;
      if (!rawCategory) {
        rowErrors.push('Category is required');
      } else if (validateType(type)) {
        category = categoryPoolFor(type).find(
          (item) => item.toLowerCase() === rawCategory.toLowerCase()
        );
        if (!category) {
          rowErrors.push(`"${rawCategory}" is not a ${type} category`);
        }
      }

      const rawDescription = cell(row, 'description');
      const description = unguardFormula(rawDescription);
      if (!description) {
        rowErrors.push('Description is required');
      } else if (isMaskedValue(rawDescription)) {
        rowErrors.push('Masked exports cannot be imported. Download without privacy mode first');
      } else if (description.length > 500) {
        rowErrors.push('Description must be 500 characters or fewer');
      }

      const frequency = cell(row, 'frequency').toLowerCase();
      if (!validateFrequency(frequency)) {
        rowErrors.push('Frequency must be weekly, monthly or yearly');
      }

      const nextOccurrence = parseImportDate(cell(row, 'nextOccurrence'));
      if (!nextOccurrence) rowErrors.push('Next Occurrence must be YYYY-MM-DD or DD/MM/YYYY');

      const rawStatus = cell(row, 'status');
      let isActive = 1;
      if (rawStatus) {
        const status = IMPORT_STATUS_ALIASES[rawStatus.toLowerCase()];
        if (status === undefined) {
          rowErrors.push('Status must be Active or Paused');
        } else {
          isActive = status;
        }
      }

      if (rowErrors.length) {
        errors.push({ line, message: rowErrors.join('; ') });
        return;
      }

      valid.push({
        line,
        type,
        amount,
        category,
        description,
        frequency,
        nextOccurrence,
        isActive,
      });
    });

    const keys = new Set();
    if (valid.length) {
      const existing = await query.all(
        'SELECT * FROM recurring_transactions WHERE user_id = ?',
        [req.user.id]
      );
      for (const row of existing) {
        const item = serialize(row);
        keys.add(
          recurringDuplicateKey({
            type: item.type,
            amount: item.amount,
            category: item.category,
            description: item.description,
            frequency: item.frequency,
            nextOccurrence: item.next_occurrence,
            isActive: item.is_active,
          })
        );
      }
    }

    const toInsert = [];
    let duplicateCount = 0;
    const duplicateRows = [];

    for (const item of valid) {
      const key = recurringDuplicateKey(item);
      if (keys.has(key)) {
        duplicateCount += 1;
        if (duplicateRows.length < 20) {
          duplicateRows.push({
            line: item.line,
            summary: `${item.type} · ${item.category} · ${item.description} · ${item.nextOccurrence}`,
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
          `INSERT INTO recurring_transactions (user_id, description, description_encrypted, type, amount, category, frequency, next_occurrence, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            '',
            encrypt(item.description),
            item.type,
            item.amount,
            item.category,
            item.frequency,
            item.nextOccurrence,
            item.isActive,
          ]
        );
      }

      await query.run('COMMIT');
      started = false;
    }

    logAudit(
      req.user.id,
      'recurring_imported',
      'recurring',
      `Imported ${toInsert.length} recurring schedule(s) from CSV (${duplicateCount} duplicate(s) skipped, ${errors.length} row(s) rejected)`,
      req.ip
    );

    res.status(201).json({
      totalRows: dataRows.length,
      imported: toInsert.length,
      duplicates: duplicateCount,
      duplicateRows,
      rejected: errors.length,
      errors: errors.slice(0, IMPORT_ERROR_LIMIT),
    });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[recurring] import rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};
