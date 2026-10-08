const query = require('../database/query');
const logAudit = require('../utils/auditLogger');

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
