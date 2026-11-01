const { EXPENSE_CATEGORIES } = require('../utils/validation');
const { addFrequency } = require('../utils/recurringProcessor');
const { median, round2 } = require('./stats');
const { monthsBefore, monthlySeries, addDays } = require('./context');
const { proof, input, confidence, weaker } = require('./explain');

function committedOccurrencesRemaining(recurring, period) {
  if (!period.isCurrent) return { total: 0, items: [] };

  const fromDate = addDays(period.today, 1);
  const items = [];
  let total = 0;

  for (const template of recurring || []) {
    if (template.type !== 'expense') continue;
    let date = template.next_occurrence;
    let guard = 0;
    while (date <= period.end && guard < 60) {
      if (date >= fromDate) {
        const amount = Number(template.amount);
        items.push({
          recurring_id: template.id,
          category: template.category,
          date,
          amount: round2(amount),
          frequency: template.frequency,
        });
        total += amount;
      }
      date = addFrequency(date, template.frequency);
      guard += 1;
    }
  }

  return { total: round2(total), items };
}

function statusFor({ budget, spent, projected, period }) {
  if (budget === null || budget === undefined) return 'unbudgeted';
  if (period.isPast) return spent > budget ? 'exceeded' : 'within_budget';
  if (spent > budget) return 'exceeded';
  if (projected > budget) return 'at_risk';
  if (period.daysElapsed / period.daysInMonth >= 0.5 && projected < budget * 0.7) {
    return 'underspending';
  }
  return 'on_track';
}

function buildPacing({ transactions, budgets, period }) {
  const currentExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date >= period.start && t.date <= period.end
  );
  const history = transactions.filter((t) => t.type === 'expense' && t.date < period.start);
  const priorMonths = monthsBefore(period.month, period.year, 3);
  const budgetByCategory = new Map((budgets || []).map((b) => [b.category, Number(b.amount)]));

  const activeCategories = new Set(budgetByCategory.keys());
  for (const t of currentExpenses) activeCategories.add(t.category);
  for (const category of EXPENSE_CATEGORIES) {
    if (monthlySeries(history, priorMonths, category, 'expense').some((v) => v > 0)) {
      activeCategories.add(category);
    }
  }

  const rows = [];
  for (const category of EXPENSE_CATEGORIES) {
    if (!activeCategories.has(category)) continue;

    const spent = round2(
      currentExpenses
        .filter((t) => t.category === category)
        .reduce((acc, t) => acc + Number(t.amount), 0)
    );
    const budget = budgetByCategory.has(category) ? budgetByCategory.get(category) : null;
    const series = monthlySeries(history, priorMonths, category, 'expense');
    const activeMonths = series.filter((v) => v > 0).length;

    let dailyRate = 0;
    let method = 'no history; spent to date only';
    let rateConfidence = 'low';

    if (activeMonths > 0) {
      const rates = series.map((value, index) => value / priorMonths[index].daysInMonth);
      dailyRate = median(rates);
      method = `median daily rate across ${priorMonths.length} prior month(s)`;
      rateConfidence = activeMonths >= 3 ? 'medium' : 'low';
    } else if (period.daysElapsed > 0) {
      dailyRate = spent / period.daysElapsed;
      method = 'linear pace from this month only';
    }

    const daysLeft = period.isPast ? 0 : period.daysRemaining;
    const projected = round2(spent + dailyRate * daysLeft);
    const status = statusFor({ budget, spent, projected, period });
    const remaining = budget === null ? null : round2(budget - spent);
    const variance = budget === null ? null : round2(projected - budget);

    rows.push({
      category,
      budget,
      spent,
      projected,
      remaining,
      variance,
      percentUsed: budget ? round2((spent / budget) * 100) : null,
      status,
      confidence: period.isPast ? 'high' : rateConfidence,
      method: period.isPast ? 'actual spend for a completed month' : method,
      historyMonths: activeMonths,
    });
  }

  const budgetTotal = round2(rows.reduce((acc, r) => acc + (r.budget || 0), 0));
  const spentTotal = round2(rows.reduce((acc, r) => acc + r.spent, 0));
  const projectedTotal = round2(rows.reduce((acc, r) => acc + r.projected, 0));
  const overspendNow = round2(
    rows.reduce((acc, r) => acc + (r.budget !== null && r.spent > r.budget ? r.spent - r.budget : 0), 0)
  );

  return {
    status: 'available',
    rows,
    totals: {
      budgetTotal,
      spentTotal,
      projectedTotal,
      varianceTotal: budgetTotal > 0 ? round2(projectedTotal - budgetTotal) : null,
      overspendNow,
    },
  };
}

function buildSafeToSpend({ transactions, budgets, plan, period, recurring, income, pacing }) {
  const spentTotal = pacing.totals.spentTotal;
  const budgetTotal = pacing.totals.budgetTotal;
  const savingsTarget = plan && Number(plan.savings_target) > 0 ? Number(plan.savings_target) : 0;
  const committed = committedOccurrencesRemaining(recurring, period);

  if (period.isPast) {
    return {
      ...proof({
        value: 0,
        method: 'not applicable to a completed month',
        inputs: [input('month', period.key)],
        assumptions: [],
        confidence: confidence('high', 'the month is closed'),
        trace: { month: period.key },
      }),
      available: 0,
      committedRemaining: 0,
      daysRemaining: 0,
      usingBudgets: budgetTotal > 0,
    };
  }

  let base;
  let remaining;
  let method;
  let assumptions;
  let level;

  if (budgetTotal > 0) {
    base = budgetTotal;
    remaining = round2(budgetTotal - spentTotal);
    method = '(budget total − spent so far − committed charges) ÷ days remaining';
    assumptions = [
      'category budgets are the spendable envelope',
      'spending in unbudgeted categories still reduces the envelope',
    ];
    level = 'medium';
  } else if (income && income.value > 0) {
    base = round2(income.value - savingsTarget);
    remaining = round2(base - spentTotal);
    method = '(forecast income − savings target − spent so far − committed charges) ÷ days remaining';
    assumptions = ['no budgets exist, so the income estimate is the envelope'];
    level = weaker('low', income.confidence.level);
  } else {
    return {
      ...proof({
        value: 0,
        method: 'no budgets and no income estimate',
        inputs: [
          input('budget total', 0),
          input('income estimate', null),
        ],
        assumptions: ['set a budget or add income history to unlock this'],
        confidence: confidence('low', 'missing both inputs'),
        trace: { month: period.key },
      }),
      available: 0,
      committedRemaining: 0,
      daysRemaining: period.daysRemaining,
      usingBudgets: false,
    };
  }

  const available = round2(Math.max(0, remaining - committed.total));
  const perDay = period.daysRemaining > 0 ? round2(available / period.daysRemaining) : 0;

  if (budgetTotal > 0) {
    const budgetedCategories = new Set((budgets || []).map((b) => b.category));
    const activeCategories = pacing.rows.length || 1;
    const coverageRatio = budgetedCategories.size / activeCategories;
    if (coverageRatio < 0.6) level = 'low';
    else if (coverageRatio < 0.9) level = weaker(level, 'medium');
  }

  const projectedExpense = pacing.totals.projectedTotal;
  const projectedSavings =
    income && income.value !== null ? round2(income.value - projectedExpense) : null;

  return {
    ...proof({
      value: perDay,
      unit: 'INR/day',
      method,
      inputs: [
        input('envelope base', base, budgetTotal > 0 ? 'budgets' : 'income − savings target'),
        input('spent so far', spentTotal, 'transactions in period'),
        input('committed charges remaining', committed.total, 'active recurring templates'),
        input('days remaining', period.daysRemaining),
      ],
      assumptions,
      confidence: confidence(level, `${(budgets || []).length} budget(s), ${committed.items.length} upcoming charge(s)`),
      trace: {
        month: period.key,
        available,
        daysRemaining: period.daysRemaining,
      },
    }),
    available,
    committedRemaining: committed.total,
    daysRemaining: period.daysRemaining,
    usingBudgets: budgetTotal > 0,
    savings: {
      target: round2(savingsTarget),
      projected: projectedSavings,
      onTrack: projectedSavings === null ? null : projectedSavings >= savingsTarget,
    },
  };
}

module.exports = {
  committedOccurrencesRemaining,
  buildPacing,
  buildSafeToSpend,
};
