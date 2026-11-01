const query = require('../database/query');
const logAudit = require('../utils/auditLogger');
const { parseCsv } = require('../utils/csv');
const {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_ERROR_LIMIT,
  mapHeaders,
  parseImportAmount,
  unguardFormula,
  isMaskedValue,
} = require('../utils/importHelpers');

const IMPORT_HEADER_ALIASES = {
  month: ['month'],
  year: ['year'],
  category: ['category', 'head'],
  amount: ['amount', 'value', 'amount (inr)', 'amount inr'],
};

function getMonthYearParams(month, year) {
  const now = new Date();
  return {
    month: month ? Number(month) : now.getMonth() + 1,
    year: year ? Number(year) : now.getFullYear(),
  };
}

async function getSpentForBudget(userId, category, month, year) {
  const row = await query.get(
    `SELECT COALESCE(SUM(amount), 0) as spent
     FROM transactions
     WHERE user_id = ? AND type = 'expense' AND category = ?
     AND CAST(strftime('%m', date) AS INTEGER) = ?
     AND CAST(strftime('%Y', date) AS INTEGER) = ?`,
    [userId, category, month, year]
  );
  return Number(row.spent || 0);
}

function computeProgress(budget, spent) {
  const amount = budget.amount;
  const remaining = amount - spent;
  const percentage = amount > 0 ? Math.round((spent / amount) * 100) : 0;
  let status = 'normal';
  let message = '';

  if (percentage >= 100) {
    status = 'exceeded';
    message = percentage > 100
      ? `You have exceeded your ${budget.category} budget.`
      : `You have reached your ${budget.category} budget.`;
  } else if (percentage >= 80) {
    status = 'approaching';
    message = `You're approaching your ${budget.category} budget.`;
  }

  return {
    spent,
    remaining,
    percentage,
    status,
    message,
  };
}

exports.getAllBudgets = async (req, res, next) => {
  try {
    const { month, year } = getMonthYearParams(req.query.month, req.query.year);
    const rows = await query.all(
      'SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ? ORDER BY id DESC',
      [req.user.id, month, year]
    );

    const result = [];
    for (const row of rows) {
      const spent = await getSpentForBudget(req.user.id, row.category, month, year);
      const progress = computeProgress(row, spent);
      result.push({
        id: row.id,
        category: row.category,
        amount: row.amount,
        month: row.month,
        year: row.year,
        spent: progress.spent,
        remaining: progress.remaining,
        percentage: progress.percentage,
        status: progress.status,
        message: progress.message,
        created_at: row.created_at,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getBudgetById = async (req, res, next) => {
  try {
    const row = await query.get(
      'SELECT * FROM budgets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!row) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    const spent = await getSpentForBudget(req.user.id, row.category, row.month, row.year);
    const progress = computeProgress(row, spent);
    res.json({
      id: row.id,
      category: row.category,
      amount: row.amount,
      month: row.month,
      year: row.year,
      spent: progress.spent,
      remaining: progress.remaining,
      percentage: progress.percentage,
      status: progress.status,
      message: progress.message,
      created_at: row.created_at,
    });
  } catch (err) {
    next(err);
  }
};

exports.createBudget = async (req, res, next) => {
  try {
    const { category, amount, month, year } = req.body;

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    const m = Number(month);
    const y = Number(year);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const existing = await query.get(
      'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?',
      [req.user.id, category, m, y]
    );
    if (existing) {
      return res.status(409).json({ error: 'A budget already exists for this category and month' });
    }

    const result = await query.run(
      'INSERT INTO budgets (user_id, category, amount, month, year) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, category, amount, m, y]
    );

    logAudit(req.user.id, 'budget_created', 'budget', `Created budget #${result.lastID}`, req.ip);

    const row = await query.get('SELECT * FROM budgets WHERE id = ?', [result.lastID]);
    const spent = await getSpentForBudget(req.user.id, row.category, row.month, row.year);
    const progress = computeProgress(row, spent);

    res.status(201).json({
      id: row.id,
      category: row.category,
      amount: row.amount,
      month: row.month,
      year: row.year,
      spent,
      remaining: progress.remaining,
      percentage: progress.percentage,
      status: progress.status,
      message: progress.message,
      created_at: row.created_at,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateBudget = async (req, res, next) => {
  try {
    const { category, amount } = req.body;

    const existing = await query.get(
      'SELECT * FROM budgets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const duplicate = await query.get(
      'SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ? AND id != ?',
      [req.user.id, category, existing.month, existing.year, req.params.id]
    );
    if (duplicate) {
      return res.status(409).json({ error: 'A budget already exists for this category and month' });
    }

    await query.run(
      'UPDATE budgets SET category = ?, amount = ? WHERE id = ? AND user_id = ?',
      [category, amount, req.params.id, req.user.id]
    );

    logAudit(req.user.id, 'budget_updated', 'budget', `Updated budget #${req.params.id}`, req.ip);

    const updated = await query.get('SELECT * FROM budgets WHERE id = ?', [req.params.id]);
    const spent = await getSpentForBudget(req.user.id, updated.category, updated.month, updated.year);
    const progress = computeProgress(updated, spent);

    res.json({
      id: updated.id,
      category: updated.category,
      amount: updated.amount,
      month: updated.month,
      year: updated.year,
      spent,
      remaining: progress.remaining,
      percentage: progress.percentage,
      status: progress.status,
      message: progress.message,
      created_at: updated.created_at,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteBudget = async (req, res, next) => {
  try {
    const existing = await query.get(
      'SELECT id FROM budgets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await query.run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    logAudit(req.user.id, 'budget_deleted', 'budget', `Deleted budget #${req.params.id}`, req.ip);

    res.json({ message: 'Budget deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getBudgetWarnings = async (req, res, next) => {
  try {
    const { month, year } = getMonthYearParams(req.query.month, req.query.year);
    const rows = await query.all(
      'SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
      [req.user.id, month, year]
    );

    const warnings = [];
    for (const row of rows) {
      const spent = await getSpentForBudget(req.user.id, row.category, month, year);
      const progress = computeProgress(row, spent);
      if (progress.status !== 'normal') {
        warnings.push({
          budget_id: row.id,
          category: row.category,
          budget_amount: row.amount,
          spent,
          remaining: progress.remaining,
          percentage: progress.percentage,
          status: progress.status,
          message: progress.message,
        });
      }
    }

    res.json(warnings);
  } catch (err) {
    next(err);
  }
};

exports.importBudgets = async (req, res, next) => {
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
      return res.status(400).json({ error: 'The CSV needs a header row and at least one budget' });
    }

    const mapping = mapHeaders(parsed[0], IMPORT_HEADER_ALIASES);
    const missing = ['month', 'year', 'category', 'amount'].filter(
      (field) => mapping[field] === undefined
    );
    if (missing.length) {
      return res.status(400).json({
        error: `Missing required column(s): ${missing.join(', ')}. Expected Month, Year, Category and Amount.`,
      });
    }

    const dataRows = parsed.slice(1);
    if (dataRows.length > IMPORT_MAX_ROWS) {
      return res.status(413).json({
        error: `A single import can contain at most ${IMPORT_MAX_ROWS} budgets`,
      });
    }

    const cell = (row, field) =>
      mapping[field] === undefined ? '' : String(row[mapping[field]] ?? '').trim();

    const valid = [];
    const errors = [];

    dataRows.forEach((row, index) => {
      const line = index + 2;
      const rowErrors = [];

      const month = Number(cell(row, 'month'));
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        rowErrors.push('Month must be between 1 and 12');
      }

      const year = Number(cell(row, 'year'));
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        rowErrors.push('Year must be between 2000 and 2100');
      }

      const category = unguardFormula(cell(row, 'category'));
      if (!category) {
        rowErrors.push('Category is required');
      } else if (category.length > 100) {
        rowErrors.push('Category must be 100 characters or fewer');
      }

      const rawAmount = cell(row, 'amount');
      const amount = parseImportAmount(rawAmount);
      if (amount === null) {
        rowErrors.push(
          isMaskedValue(rawAmount)
            ? 'Masked exports cannot be imported. Download without privacy mode first'
            : 'Amount must be a positive number'
        );
      }

      if (rowErrors.length) {
        errors.push({ line, message: rowErrors.join('; ') });
        return;
      }

      valid.push({ line, month, year, category, amount });
    });

    const existing = await query.all('SELECT * FROM budgets WHERE user_id = ?', [req.user.id]);
    const existingByKey = new Map();
    for (const row of existing) {
      existingByKey.set(`${row.category}|${row.month}|${row.year}`, row);
    }

    const toInsert = [];
    const toUpdate = [];
    const pending = new Set();
    let duplicateCount = 0;
    const duplicateRows = [];

    for (const item of valid) {
      const key = `${item.category}|${item.month}|${item.year}`;
      const current = existingByKey.get(key);

      if (!current) {
        existingByKey.set(key, item);
        pending.add(key);
        toInsert.push(item);
        continue;
      }

      if (Number(current.amount).toFixed(2) === Number(item.amount).toFixed(2)) {
        duplicateCount += 1;
        if (duplicateRows.length < 20) {
          duplicateRows.push({
            line: item.line,
            summary: `${item.category} · ${item.month}/${item.year} · ${item.amount}`,
          });
        }
        continue;
      }

      if (pending.has(key)) {
        current.amount = item.amount;
        continue;
      }

      toUpdate.push({ ...item, id: current.id });
    }

    if (toInsert.length || toUpdate.length) {
      await query.run('BEGIN');
      started = true;

      for (const item of toInsert) {
        await query.run(
          'INSERT INTO budgets (user_id, category, amount, month, year) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, item.category, item.amount, item.month, item.year]
        );
      }

      for (const item of toUpdate) {
        await query.run(
          'UPDATE budgets SET amount = ? WHERE id = ? AND user_id = ?',
          [item.amount, item.id, req.user.id]
        );
      }

      await query.run('COMMIT');
      started = false;
    }

    logAudit(
      req.user.id,
      'budgets_imported',
      'budget',
      `Imported ${toInsert.length} budget(s) and updated ${toUpdate.length} from CSV (${duplicateCount} duplicate(s) skipped, ${errors.length} row(s) rejected)`,
      req.ip
    );

    res.status(201).json({
      totalRows: dataRows.length,
      imported: toInsert.length,
      updated: toUpdate.length,
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
        console.error('[budgets] import rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};
