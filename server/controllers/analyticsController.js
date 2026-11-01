const crypto = require('crypto');
const query = require('../database/query');
const logAudit = require('../utils/auditLogger');
const { EXPENSE_CATEGORIES } = require('../utils/validation');
const { round2, clamp } = require('../analytics/stats');
const { loadContext, historyBefore, totalsInPeriod } = require('../analytics/context');
const { buildCoverage } = require('../analytics/coverage');
const { buildPacing, buildSafeToSpend } = require('../analytics/pacing');
const { detectAnomalies } = require('../analytics/anomaly');
const { committedFromTemplates, detectSubscriptions } = require('../analytics/recurrence');
const { buildRecommendation, OBJECTIVES } = require('../analytics/reallocate');
const { forecastIncome } = require('../analytics/forecast');
const { buildInsights } = require('../analytics/insights');
const { backtestForecast, backtestRecommendations } = require('../analytics/evaluate');

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

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parsePeriod(source) {
  const now = new Date();
  const rawMonth =
    source && source.month !== undefined && source.month !== ''
      ? source.month
      : now.getMonth() + 1;
  const rawYear =
    source && source.year !== undefined && source.year !== ''
      ? source.year
      : now.getFullYear();
  const month = Number(rawMonth);
  const year = Number(rawYear);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw httpError('Month must be an integer between 1 and 12');
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw httpError('Year must be between 2000 and 2100');
  }
  return { month, year };
}

async function assemble(userId, month, year) {
  const ctx = await loadContext(userId, month, year);
  const history = historyBefore(ctx.transactions, ctx.period);
  const coverage = buildCoverage(history, ctx.period, ctx.plan);
  const totals = totalsInPeriod(ctx.transactions, ctx.period);
  const income = forecastIncome(history, ctx.period, ctx.plan);
  const pacing = buildPacing({
    transactions: ctx.transactions,
    budgets: ctx.budgets,
    period: ctx.period,
  });
  const safeToSpend = buildSafeToSpend({
    transactions: ctx.transactions,
    budgets: ctx.budgets,
    plan: ctx.plan,
    period: ctx.period,
    recurring: ctx.recurring,
    income,
    pacing,
  });
  const anomalies = detectAnomalies({
    transactions: ctx.transactions,
    period: ctx.period,
  });
  const committed = committedFromTemplates(ctx.recurring);
  const detected = detectSubscriptions(ctx.transactions, ctx.period);
  const recommendation = buildRecommendation({
    transactions: ctx.transactions,
    budgets: ctx.budgets,
    plan: ctx.plan,
    recurring: ctx.recurring,
    period: ctx.period,
    objective: ctx.plan ? ctx.plan.objective : undefined,
  });
  const insights = buildInsights({
    pacing,
    anomalies,
    recurrence: { committed, detected },
    safeToSpend,
    coverage,
    recommendation,
    period: ctx.period,
  });

  return {
    ctx,
    history,
    coverage,
    totals,
    income,
    pacing,
    safeToSpend,
    anomalies,
    committed,
    detected,
    recommendation,
    insights,
  };
}

exports.overview = async (req, res, next) => {
  try {
    const { month, year } = parsePeriod(req.query);
    const data = await assemble(req.user.id, month, year);
    const { ctx, coverage, totals, income, pacing, safeToSpend, anomalies, committed, detected, recommendation, insights } = data;

    res.json({
      period: {
        month: ctx.period.month,
        year: ctx.period.year,
        key: ctx.period.key,
        daysRemaining: ctx.period.daysRemaining,
        isCurrent: ctx.period.isCurrent,
      },
      totals: {
        income: round2(totals.income),
        expense: round2(totals.expense),
        net: round2(totals.net),
        transactionCount: totals.transactionCount,
      },
      coverage: {
        tier: coverage.tier,
        monthsObserved: coverage.monthsObserved,
        expenseMonths: coverage.expenseMonths,
        incomeMonths: coverage.incomeMonths,
        totalTransactions: coverage.totalTransactions,
        readiness: coverage.readiness,
        nextTier: coverage.nextTier,
      },
      income,
      safeToSpend,
      pacing,
      anomalies: {
        status: anomalies.status,
        total: anomalies.total,
        threshold: anomalies.threshold,
        items: anomalies.items.slice(0, 5),
      },
      recurrence: { committed, detected },
      recommendation: {
        status: recommendation.status,
        reason: recommendation.reason || null,
        missing: recommendation.missing || [],
        objective: recommendation.objective,
        feasible: recommendation.feasible,
        envelope: recommendation.envelope,
        totalProposed: recommendation.totalProposed,
        extraSavings: recommendation.extraSavings,
        deficit: recommendation.deficit,
        notes: recommendation.notes || [],
        categoryCount: recommendation.categories ? recommendation.categories.length : 0,
      },
      insights,
    });
  } catch (err) {
    next(err);
  }
};

exports.insights = async (req, res, next) => {
  try {
    const { month, year } = parsePeriod(req.query);
    const data = await assemble(req.user.id, month, year);
    res.json({
      ...data.insights,
      coverage: {
        tier: data.coverage.tier,
        readiness: data.coverage.readiness,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.recommendations = async (req, res, next) => {
  try {
    const { month, year } = parsePeriod(req.query);
    const objective = req.query.objective;
    if (objective && !OBJECTIVES.includes(objective)) {
      throw httpError('Objective must be savings or overrun');
    }

    const ctx = await loadContext(req.user.id, month, year);
    const recommendation = buildRecommendation({
      transactions: ctx.transactions,
      budgets: ctx.budgets,
      plan: ctx.plan,
      recurring: ctx.recurring,
      period: ctx.period,
      objective,
    });

    res.json(recommendation);
  } catch (err) {
    next(err);
  }
};

exports.applyRecommendations = async (req, res, next) => {
  let started = false;

  try {
    const body = req.body || {};
    const { month, year } = parsePeriod(body);
    const objective = body.objective;

    if (objective && !OBJECTIVES.includes(objective)) {
      throw httpError('Objective must be savings or overrun');
    }
    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      throw httpError('categories must be a non-empty array');
    }

    const seen = new Set();
    const requested = body.categories.map((entry) => {
      const category = entry && entry.category;
      const amount = Number(entry && entry.amount);

      if (!EXPENSE_CATEGORIES.includes(category)) {
        throw httpError(`Unknown expense category: ${category}`);
      }
      if (seen.has(category)) {
        throw httpError(`Duplicate category: ${category}`);
      }
      seen.add(category);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
        throw httpError(`Invalid amount for ${category}`);
      }
      return { category, amount: round2(amount) };
    });

    const ctx = await loadContext(req.user.id, month, year);
    const proposal = buildRecommendation({
      transactions: ctx.transactions,
      budgets: ctx.budgets,
      plan: ctx.plan,
      recurring: ctx.recurring,
      period: ctx.period,
      objective,
    });

    if (proposal.status !== 'available') {
      throw httpError(`No recommendation available: ${proposal.reason}`, 409);
    }

    const proposalByCategory = new Map(
      proposal.categories.map((item) => [item.category, item])
    );
    for (const entry of requested) {
      if (!proposalByCategory.has(entry.category)) {
        throw httpError(`No recommendation exists for ${entry.category}`, 409);
      }
    }

    const batchId = crypto.randomUUID();
    const applied = [];
    const deleted = [];
    const warnings = [];

    await query.run('BEGIN');
    started = true;

    for (const entry of requested) {
      const evidence = proposalByCategory.get(entry.category);
      const existing = await query.get(
        'SELECT id, amount FROM budgets WHERE user_id = ? AND category = ? AND month = ? AND year = ?',
        [req.user.id, entry.category, month, year]
      );
      const previous = existing ? Number(existing.amount) : null;

      if (entry.amount <= 0) {
        if (existing) {
          await query.run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [
            existing.id,
            req.user.id,
          ]);
          deleted.push({ category: entry.category, previous: round2(previous) });
        }
      } else if (existing) {
        await query.run('UPDATE budgets SET amount = ? WHERE id = ? AND user_id = ?', [
          entry.amount,
          existing.id,
          req.user.id,
        ]);
      } else {
        await query.run(
          'INSERT INTO budgets (user_id, category, amount, month, year) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, entry.category, entry.amount, month, year]
        );
      }

      if (entry.amount > 0) {
        applied.push({
          category: entry.category,
          previous: previous === null ? null : round2(previous),
          amount: entry.amount,
          delta: round2(entry.amount - (previous || 0)),
          recommended: evidence.target,
          adjusted: Math.abs(entry.amount - evidence.target) > 0.01,
        });
      }

      if (entry.amount > 0 && entry.amount < evidence.floor - 0.01) {
        warnings.push(`${entry.category} is set below its protected floor of ₹${evidence.floor}.`);
      }

      const adjusted = Math.abs(entry.amount - evidence.target) > 0.01;
      await query.run(
        `INSERT INTO budget_recommendations
          (user_id, batch_id, month, year, category, objective, current_amount, proposed_amount, delta, reason, evidence_json, confidence, status, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied', datetime('now'))`,
        [
          req.user.id,
          batchId,
          month,
          year,
          entry.category,
          proposal.objective,
          previous,
          entry.amount,
          round2(entry.amount - (previous || 0)),
          evidence.reason,
          JSON.stringify({
            ...evidence.evidence,
            recommended: evidence.target,
            applied: entry.amount,
            adjusted,
          }),
          evidence.confidence,
        ]
      );
    }

    const appliedTotal = round2(applied.reduce((acc, item) => acc + item.amount, 0));
    if (appliedTotal > proposal.envelope + 0.01) {
      warnings.push(
        `Applied budgets total ₹${appliedTotal}, which exceeds the envelope of ₹${proposal.envelope}.`
      );
    }

    await query.run('COMMIT');
    started = false;

    logAudit(
      req.user.id,
      'recommendation_applied',
      'budget',
      `Applied recommendation batch ${batchId} for ${month}/${year}`,
      req.ip
    );

    res.json({
      batchId,
      month,
      year,
      objective: proposal.objective,
      envelope: proposal.envelope,
      appliedTotal,
      applied,
      deleted,
      warnings,
    });
  } catch (err) {
    if (started) {
      try {
        await query.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[analytics] rollback failed:', rollbackErr.message);
      }
    }
    next(err);
  }
};

exports.backtest = async (req, res, next) => {
  try {
    const { month, year } = parsePeriod(req.query);
    const monthsBack = clamp(Math.round(Number(req.query.months) || 6), 3, 12);
    const ctx = await loadContext(req.user.id, month, year);

    const [allBudgets, allPlans] = await Promise.all([
      query.all('SELECT * FROM budgets WHERE user_id = ?', [req.user.id]),
      query.all('SELECT * FROM plans WHERE user_id = ?', [req.user.id]),
    ]);

    const forecast = backtestForecast({
      transactions: ctx.transactions,
      period: ctx.period,
      monthsBack,
    });
    const recommendations = backtestRecommendations({
      transactions: ctx.transactions,
      period: ctx.period,
      monthsBack,
      budgets: allBudgets,
      plans: allPlans,
      recurring: ctx.recurring,
      objective: ctx.plan ? ctx.plan.objective : 'savings',
    });

    res.json({ period: ctx.period.key, monthsBack, forecast, recommendations });
  } catch (err) {
    next(err);
  }
};

exports.getPlan = async (req, res, next) => {
  try {
    const { month, year } = parsePeriod(req.query);
    const row = await query.get(
      'SELECT * FROM plans WHERE user_id = ? AND month = ? AND year = ?',
      [req.user.id, month, year]
    );

    res.json(
      row || {
        month,
        year,
        income_assumption: null,
        savings_target: 0,
        objective: 'savings',
      }
    );
  } catch (err) {
    next(err);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { month, year } = parsePeriod(body);

    const income =
      body.income_assumption === null ||
      body.income_assumption === undefined ||
      body.income_assumption === ''
        ? null
        : Number(body.income_assumption);
    const savings =
      body.savings_target === null ||
      body.savings_target === undefined ||
      body.savings_target === ''
        ? null
        : Number(body.savings_target);
    const objective = body.objective || 'savings';

    if (income !== null && (!Number.isFinite(income) || income < 0 || income > 1e12)) {
      throw httpError('income_assumption must be a non-negative number');
    }
    if (savings !== null && (!Number.isFinite(savings) || savings < 0 || savings > 1e12)) {
      throw httpError('savings_target must be a non-negative number');
    }
    if (!OBJECTIVES.includes(objective)) {
      throw httpError('Objective must be savings or overrun');
    }

    await query.run(
      `INSERT INTO plans (user_id, month, year, income_assumption, savings_target, objective, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, month, year) DO UPDATE SET
         income_assumption = excluded.income_assumption,
         savings_target = excluded.savings_target,
         objective = excluded.objective,
         updated_at = datetime('now')`,
      [req.user.id, month, year, income, savings, objective]
    );

    const row = await query.get(
      'SELECT * FROM plans WHERE user_id = ? AND month = ? AND year = ?',
      [req.user.id, month, year]
    );

    logAudit(req.user.id, 'plan_updated', 'plan', `Updated plan for ${month}/${year}`, req.ip);
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.assemble = assemble;
exports.parsePeriod = parsePeriod;
