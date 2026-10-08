const query = require('../database/query');

exports.spendingByCategory = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    let sql = `
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND type = 'expense'
    `;
    const params = [req.user.id];
    if (month) {
      sql += " AND CAST(strftime('%m', date) AS INTEGER) = ?";
      params.push(Number(month));
    }
    if (year) {
      sql += " AND CAST(strftime('%Y', date) AS INTEGER) = ?";
      params.push(Number(year));
    }
    sql += ' GROUP BY category ORDER BY total DESC';

    const rows = await query.all(sql, params);
    res.json(rows.map((r) => ({ category: r.category, amount: Number(r.total) })));
  } catch (err) {
    next(err);
  }
};

exports.monthlySpending = async (req, res, next) => {
  try {
    const sql = `
      SELECT strftime('%Y-%m', date) as month,
             COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
             COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income
      FROM transactions
      WHERE user_id = ?
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month ASC
    `;
    const rows = await query.all(sql, [req.user.id]);
    res.json(
      rows.map((r) => ({
        month: r.month,
        expenses: Number(r.expenses),
        income: Number(r.income),
      }))
    );
  } catch (err) {
    next(err);
  }
};

exports.incomeVsExpenses = async (req, res, next) => {
  try {
    const incomeRow = await query.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = ?',
      [req.user.id, 'income']
    );
    const expenseRow = await query.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = ?',
      [req.user.id, 'expense']
    );

    res.json({
      income: Number(incomeRow.total || 0),
      expense: Number(expenseRow.total || 0),
    });
  } catch (err) {
    next(err);
  }
};

exports.summary = async (req, res, next) => {
  try {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = String(now.getFullYear());

    const catRow = await query.get(
      `SELECT category, SUM(amount) as total
       FROM transactions
       WHERE user_id = ? AND type = 'expense'
       GROUP BY category
       ORDER BY total DESC
       LIMIT 1`,
      [req.user.id]
    );

    const monthExpenseRow = await query.get(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ? AND type = 'expense'
       AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
      [req.user.id, currentMonth, currentYear]
    );

    const monthIncomeRow = await query.get(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ? AND type = 'income'
       AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
      [req.user.id, currentMonth, currentYear]
    );

    const totalIncome = Number(monthIncomeRow.total || 0);
    const totalExpense = Number(monthExpenseRow.total || 0);

    res.json({
      highestSpendingCategory: catRow ? catRow.category : null,
      totalSpendingThisMonth: totalExpense,
      totalIncomeThisMonth: totalIncome,
      netSavingsThisMonth: totalIncome - totalExpense,
    });
  } catch (err) {
    next(err);
  }
};
