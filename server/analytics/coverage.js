const { EXPENSE_CATEGORIES } = require('../utils/validation');
const { round2 } = require('./stats');

const REQUIREMENTS = {
  pacing: {
    label: 'Budget pacing',
    minMonths: 0,
    minTxPerCategory: 0,
    minCategories: 0,
    requiresIncome: false,
    unlocks: 'Projected month-end spend and overrun risk per category',
  },
  safeToSpend: {
    label: 'Safe to spend',
    minMonths: 0,
    minTxPerCategory: 0,
    minCategories: 0,
    requiresIncome: false,
    unlocks: 'A daily allowance that respects what is already committed',
  },
  anomaly: {
    label: 'Unusual transactions',
    minMonths: 1,
    minTxPerCategory: 5,
    minCategories: 1,
    requiresIncome: false,
    unlocks: 'Transactions far outside your normal range for that category',
  },
  recurrence: {
    label: 'Recurring charges',
    minMonths: 1,
    minTxPerCategory: 0,
    minCategories: 0,
    requiresIncome: false,
    unlocks: 'Monthly commitments and subscription leakage',
  },
  forecast: {
    label: 'Spending forecast',
    minMonths: 2,
    minTxPerCategory: 2,
    minCategories: 2,
    requiresIncome: false,
    unlocks: 'A range for next month per category, not a single guess',
  },
  envelope: {
    label: 'Budget recommendation',
    minMonths: 3,
    minTxPerCategory: 3,
    minCategories: 3,
    requiresIncome: true,
    unlocks: 'Objective-aware budgets with floors, caps and reasons',
  },
  trend: {
    label: 'Category trends',
    minMonths: 4,
    minTxPerCategory: 4,
    minCategories: 1,
    requiresIncome: false,
    unlocks: 'Direction and slope of each category over time',
  },
  backtest: {
    label: 'Accuracy backtest',
    minMonths: 3,
    minTxPerCategory: 2,
    minCategories: 1,
    requiresIncome: false,
    unlocks: 'Measured forecast error and a recommendation counterfactual',
  },
};

const TIER_MIN_MONTHS = [0, 1, 3, 6];

function tierFor(expenseMonths) {
  if (expenseMonths >= 6) {
    return {
      level: 3,
      label: 'Seasonal view',
      detail: 'Six or more months allow trend and seasonal context.',
    };
  }
  if (expenseMonths >= 3) {
    return {
      level: 2,
      label: 'Forecast and plan',
      detail: 'Three or more months support forecasts and budget recommendations.',
    };
  }
  if (expenseMonths >= 1) {
    return {
      level: 1,
      label: 'Pacing',
      detail: 'One completed month is enough for pace and unusual-spending checks.',
    };
  }
  return {
    level: 0,
    label: 'Getting started',
    detail: 'A completed month of transactions unlocks the first layer of analysis.',
  };
}

function eligibleCategoryCount(perCategory, minTxPerCategory) {
  return Object.values(perCategory).filter((c) => c.n >= minTxPerCategory).length;
}

function evaluateRequirement(key, requirement, coverage) {
  const missing = [];

  if (coverage.expenseMonths < requirement.minMonths) {
    const gap = requirement.minMonths - coverage.expenseMonths;
    missing.push(`${gap} more month${gap === 1 ? '' : 's'} with expenses`);
  }

  if (requirement.minCategories > 0) {
    const eligible = eligibleCategoryCount(coverage.perCategory, requirement.minTxPerCategory);
    if (eligible < requirement.minCategories) {
      const gap = requirement.minCategories - eligible;
      missing.push(
        `${gap} more categor${gap === 1 ? 'y' : 'ies'} with ${requirement.minTxPerCategory}+ expenses`
      );
    }
  }

  if (requirement.requiresIncome && !coverage.hasPlanIncome && coverage.incomeMonths < 2) {
    missing.push('two income months or an income assumption in the plan');
  }

  return {
    key,
    label: requirement.label,
    status: missing.length ? 'locked' : 'available',
    missing,
    unlocks: requirement.unlocks,
  };
}

function buildCoverage(history, period, plan) {
  const months = new Map();
  const perCategory = {};
  for (const category of EXPENSE_CATEGORIES) {
    perCategory[category] = { n: 0, monthKeys: new Set(), total: 0 };
  }

  let totalTransactions = 0;
  for (const t of history || []) {
    const key = String(t.date).slice(0, 7);
    if (!months.has(key)) months.set(key, { expense: 0, income: 0, n: 0 });
    const bucket = months.get(key);
    bucket.n += 1;
    totalTransactions += 1;

    if (t.type === 'income') {
      bucket.income += Number(t.amount);
    } else {
      bucket.expense += Number(t.amount);
      if (perCategory[t.category]) {
        perCategory[t.category].n += 1;
        perCategory[t.category].monthKeys.add(key);
        perCategory[t.category].total += Number(t.amount);
      }
    }
  }

  const monthKeys = [...months.keys()].sort();
  const expenseMonths = monthKeys.filter((k) => months.get(k).expense > 0).length;
  const incomeMonths = monthKeys.filter((k) => months.get(k).income > 0).length;
  const hasPlanIncome = !!(plan && Number(plan.income_assumption) > 0);

  const perCategoryOut = {};
  for (const [category, value] of Object.entries(perCategory)) {
    perCategoryOut[category] = {
      n: value.n,
      months: value.monthKeys.size,
      total: round2(value.total),
    };
  }

  const coverage = {
    monthsObserved: monthKeys.length,
    expenseMonths,
    incomeMonths,
    totalTransactions,
    firstMonth: monthKeys[0] || null,
    lastMonth: monthKeys[monthKeys.length - 1] || null,
    perCategory: perCategoryOut,
    hasPlanIncome,
    tier: tierFor(expenseMonths),
  };

  coverage.readiness = Object.entries(REQUIREMENTS).map(([key, requirement]) =>
    evaluateRequirement(key, requirement, coverage)
  );

  const nextLevel = coverage.tier.level + 1;
  if (nextLevel < TIER_MIN_MONTHS.length) {
    coverage.nextTier = {
      level: nextLevel,
      label: tierFor(TIER_MIN_MONTHS[nextLevel]).label,
      monthsNeeded: TIER_MIN_MONTHS[nextLevel] - expenseMonths,
    };
  } else {
    coverage.nextTier = null;
  }

  return coverage;
}

function requirementFor(key) {
  return REQUIREMENTS[key] || null;
}

module.exports = {
  REQUIREMENTS,
  tierFor,
  buildCoverage,
  requirementFor,
};
