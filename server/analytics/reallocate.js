const { EXPENSE_CATEGORIES } = require('../utils/validation');
const {
  median,
  quantile,
  robustSigma,
  clamp,
  round2,
} = require('./stats');
const { monthsBefore, monthlySeries, historyBefore } = require('./context');
const { forecastSeries, forecastIncome } = require('./forecast');
const { buildCoverage } = require('./coverage');
const { committedFromTemplates } = require('./recurrence');

const ESSENTIAL_DEFAULT = new Set(['Bills', 'Food', 'Health', 'Transport', 'Education']);
const OBJECTIVES = ['savings', 'overrun'];

function resolveEssential(category, history) {
  const flags = history
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.category === category &&
        t.is_essential !== null &&
        t.is_essential !== undefined
    )
    .map((t) => Number(t.is_essential));

  if (flags.length >= 3) {
    return {
      essential: flags.filter(Boolean).length * 2 >= flags.length,
      source: 'majority of your transaction flags',
    };
  }
  return {
    essential: ESSENTIAL_DEFAULT.has(category),
    source: 'category default',
  };
}

function effectiveEssential(category, history) {
  return resolveEssential(category, history).essential;
}

function reduceToEnvelope(items, envelope) {
  let excess = round2(items.reduce((acc, item) => acc + item.target, 0) - envelope);

  for (const essential of [false, true]) {
    if (excess <= 0.01) break;
    const pool = items.filter(
      (item) => item.essential === essential && item.target > item.floor + 0.01
    );
    if (!pool.length) continue;

    const reducible = pool.reduce((acc, item) => acc + (item.target - item.floor), 0);
    const cut = Math.min(excess, reducible);
    if (cut <= 0) continue;

    for (const item of pool) {
      const share = reducible > 0 ? (item.target - item.floor) / reducible : 0;
      item.target = round2(Math.max(item.floor, item.target - cut * share));
    }

    excess = round2(items.reduce((acc, item) => acc + item.target, 0) - envelope);
  }

  return Math.max(0, excess);
}

function distributeResidual(items, residual) {
  const before = items.reduce((acc, item) => acc + item.target, 0);
  if (residual <= 0.01) return { allocated: 0, unallocated: residual };

  const pool = items.filter((item) => item.essential && item.cap > item.target + 0.01);
  const capacity = pool.reduce((acc, item) => acc + (item.cap - item.target), 0);
  if (capacity <= 0.01) return { allocated: 0, unallocated: residual };

  const amount = Math.min(residual, capacity);
  for (const item of pool) {
    const share = (item.cap - item.target) / capacity;
    item.target = round2(Math.min(item.cap, item.target + amount * share));
  }

  const after = items.reduce((acc, item) => acc + item.target, 0);
  return {
    allocated: round2(after - before),
    unallocated: round2(Math.max(0, residual - (after - before))),
  };
}

function stabilityBasis(item, bound) {
  if (bound === 'cap') return '120% of the current budget';
  const lower = Math.max(item.floor, item.currentBudget * 0.8);
  return lower <= item.floor + 0.01 ? 'the protected floor' : '80% of the current budget';
}

function reasonFor(item, objective, current) {
  const parts = [];

  if (objective === 'savings') {
    if (item.essential) {
      parts.push(
        `Essential: floor ₹${item.floor} protects your usual spend and committed charges.`
      );
    } else if (item.stabilityBound === 'floor' && item.median <= 0) {
      parts.push(
        'Discretionary: no completed-month history, so the target is anchored to the current budget.'
      );
    } else {
      parts.push(
        `Discretionary: lean target at 90% of the ₹${item.median} three-month median.`
      );
    }
  } else {
    parts.push(
      `Forecast ₹${item.forecast.point} (range ₹${item.forecast.low}–₹${item.forecast.high}) from ${item.forecast.sampleSize} month(s).`
    );
  }

  if (item.stabilityBound) {
    const basis = stabilityBasis(item, item.stabilityBound);
    if (item.stabilityBound === 'floor' && item.target < item.stabilityLimit - 0.01) {
      parts.push(
        `Held at ₹${item.stabilityLimit} (${basis}) by the stability band, then reduced to ₹${item.target} to fit the envelope; the history-based target was lower.`
      );
    } else {
      parts.push(
        item.stabilityBound === 'floor'
          ? `Held at ₹${item.stabilityLimit} (${basis}) to avoid a sudden cut, because the history-based target is lower.`
          : `Capped at ₹${item.stabilityLimit} (${basis}) to avoid a sudden jump, because the history-based target is higher.`
      );
    }
  }

  if (item.committedMonthly > 0) {
    parts.push(`Includes ₹${item.committedMonthly}/month of recurring charges.`);
  }

  if (current === null || current === undefined) {
    parts.push('No existing budget for this category.');
  } else if (item.target > current + 0.01) {
    parts.push(
      item.forecast.point > current
        ? `Raised from ₹${current} because the forecast exceeds the current amount.`
        : `Raised from ₹${current} to restore the essential floor.`
    );
  } else if (item.target < current - 0.01) {
    parts.push(`Cut from ₹${current} to free money for higher-priority categories.`);
  } else {
    parts.push('Held at the current amount.');
  }

  if (item.cv > 0.6) {
    parts.push(`Spending is volatile (${Math.round(item.cv * 100)}% variation), so confidence is low.`);
  }

  return parts.join(' ');
}

function lockedResult(reason, coverage, period, objective) {
  const envelopeGate = coverage.readiness.find((r) => r.key === 'envelope');
  return {
    period: { month: period.month, year: period.year, key: period.key },
    objective,
    status: 'locked',
    reason,
    missing: envelopeGate ? envelopeGate.missing : [],
    coverage: { tier: coverage.tier, readiness: coverage.readiness },
    categories: [],
    skipped: [],
    notes: [],
  };
}

function buildRecommendation({
  transactions,
  budgets,
  plan,
  recurring,
  period,
  objective,
}) {
  const objectiveOut = OBJECTIVES.includes(objective)
    ? objective
    : plan && OBJECTIVES.includes(plan.objective)
      ? plan.objective
      : 'savings';

  const history = historyBefore(transactions, period);
  const coverage = buildCoverage(history, period, plan);
  const envelopeGate = coverage.readiness.find((r) => r.key === 'envelope');

  if (envelopeGate && envelopeGate.status === 'locked') {
    return lockedResult('Not enough history for a budget recommendation yet.', coverage, period, objectiveOut);
  }

  const income = forecastIncome(history, period, plan);
  if (!income) {
    return lockedResult('No income estimate is available for this month.', coverage, period, objectiveOut);
  }

  const lookback = Math.min(6, Math.max(1, coverage.expenseMonths));
  const months = monthsBefore(period.month, period.year, lookback);
  const savingsTarget =
    plan && Number(plan.savings_target) > 0 ? Number(plan.savings_target) : 0;
  const envelope = round2(Math.max(0, income.value - savingsTarget));
  const committed = committedFromTemplates(recurring);
  const budgetByCategory = new Map((budgets || []).map((b) => [b.category, Number(b.amount)]));

  const items = [];
  const skipped = [];

  for (const category of EXPENSE_CATEGORIES) {
    const series = monthlySeries(history, months, category, 'expense');
    const activeMonths = series.filter((v) => v > 0).length;
    const currentBudget = budgetByCategory.has(category) ? budgetByCategory.get(category) : null;
    const committedCategory = committed.byCategory[category] || 0;

    if (activeMonths === 0 && committedCategory === 0 && currentBudget === null) {
      skipped.push({ category, reason: 'no spending history, recurring charge or existing budget' });
      continue;
    }

    const center = median(series);
    const sigma = robustSigma(series);
    const cv = center > 0 ? sigma / center : 0;
    const forecast = forecastSeries(series);
    const essentialInfo = resolveEssential(category, history);
    const essential = essentialInfo.essential;
    const p25 = quantile(series, 0.25);

    const floor = round2(
      Math.max(committedCategory, essential ? Math.max(p25, center * 0.85) : 0)
    );
    const baseCap =
      currentBudget !== null
        ? currentBudget * 1.2
        : Math.max(center, forecast.point, forecast.high, committedCategory) * 1.25;
    const cap = round2(Math.max(floor, baseCap));

    const target =
      objectiveOut === 'savings'
        ? essential
          ? Math.max(floor, Math.min(center, cap))
          : Math.max(floor, Math.min(center * 0.9, cap))
        : clamp(forecast.point, floor, cap);

    let level = 'low';
    if (activeMonths === 0 && committedCategory > 0) level = 'high';
    else if (forecast.sampleSize >= 5 && cv <= 0.35) level = 'high';
    else if (forecast.sampleSize >= 3 && cv <= 0.7) level = 'medium';

    items.push({
      category,
      essential,
      essentialSource: essentialInfo.source,
      currentBudget,
      committedMonthly: round2(committedCategory),
      median: round2(center),
      p25: round2(p25),
      sigma: round2(sigma),
      cv: round2(cv),
      forecast,
      floor,
      cap,
      target: round2(target),
      confidence: level,
      historyMonths: activeMonths,
      series,
    });
  }

  if (!items.length) {
    return lockedResult('No categories have enough evidence to budget.', coverage, period, objectiveOut);
  }

  const limitedByStability = [];
  for (const item of items) {
    if (item.currentBudget === null) continue;
    const lower = Math.max(item.floor, item.currentBudget * 0.8);
    const upper = Math.max(lower, item.currentBudget * 1.2);
    const before = item.target;
    const bound = before < lower - 0.01 ? 'floor' : before > upper + 0.01 ? 'cap' : null;
    item.target = round2(clamp(before, lower, upper));
    if (bound) {
      item.stabilityBound = bound;
      item.stabilityLimit = round2(bound === 'floor' ? lower : upper);
      item.targetBeforeStability = before;
      limitedByStability.push(item.category);
    }
  }

  const notes = [];
  if (savingsTarget > income.value) {
    notes.push(
      `The savings target exceeds forecast income. Reduce it by at least ₹${round2(savingsTarget - income.value)} for a feasible plan.`
    );
  }

  let totalProposed = round2(items.reduce((acc, item) => acc + item.target, 0));
  let deficit = 0;

  if (totalProposed > envelope + 0.01) {
    deficit = reduceToEnvelope(items, envelope);
    totalProposed = round2(items.reduce((acc, item) => acc + item.target, 0));
    if (deficit > 0.01) {
      notes.push(
        `Even at protected floors, commitments exceed the envelope by ₹${round2(deficit)}. Reduce the savings target or raise the income assumption.`
      );
    } else {
      notes.push('Discretionary categories were reduced first to fit the envelope; essentials were protected.');
    }
  } else if (objectiveOut === 'overrun') {
    const residual = round2(envelope - totalProposed);
    const distribution = distributeResidual(items, residual);
    totalProposed = round2(items.reduce((acc, item) => acc + item.target, 0));
    if (distribution.unallocated > 0.01) {
      notes.push(
        `₹${distribution.unallocated} of the envelope is not needed by any forecast and can go to savings.`
      );
    }
  } else {
    const extra = round2(envelope - totalProposed);
    if (extra > 0.01) {
      notes.push(`Lean budgets leave ₹${extra} unallocated; that amount can be locked in as extra savings.`);
    }
  }

  for (const item of items) {
    item.reason = reasonFor(item, objectiveOut, item.currentBudget);
    item.delta = round2(item.target - (item.currentBudget || 0));
    item.evidence = {
      monthsUsed: months.length,
      historyMonthsWithSpend: item.historyMonths,
      monthlySeries: item.series,
      centralEstimate: item.median,
      dispersion: item.sigma,
      forecast: {
        point: item.forecast.point,
        low: item.forecast.low,
        high: item.forecast.high,
        method: item.forecast.method,
        sampleSize: item.forecast.sampleSize,
      },
      floorBasis: item.essential
        ? 'max(committed recurring, 25th percentile, 85% of median)'
        : 'committed recurring charges only',
      capBasis:
        item.currentBudget !== null
          ? 'existing budget ±20%'
          : '1.25× the largest observed month',
      essentialSource: item.essentialSource,
      stabilityLimited: limitedByStability.includes(item.category),
      stabilityBound: item.stabilityBound || null,
      stabilityLimit: item.stabilityLimit || null,
      targetBeforeStability: item.targetBeforeStability === undefined ? null : item.targetBeforeStability,
    };
    delete item.series;
  }

  return {
    period: { month: period.month, year: period.year, key: period.key },
    objective: objectiveOut,
    status: 'available',
    coverage: { tier: coverage.tier, readiness: coverage.readiness },
    income,
    savingsTarget: round2(savingsTarget),
    envelope,
    committed: {
      totalMonthly: committed.totalMonthly,
      byCategory: committed.byCategory,
      activeTemplates: committed.items.length,
    },
    feasible: deficit <= 0.01,
    deficit: round2(deficit),
    totalCurrent: round2(items.reduce((acc, item) => acc + (item.currentBudget || 0), 0)),
    totalProposed,
    extraSavings: round2(Math.max(0, envelope - totalProposed)),
    categories: items,
    skipped,
    limitedByStability,
    notes,
  };
}

module.exports = {
  ESSENTIAL_DEFAULT,
  OBJECTIVES,
  resolveEssential,
  effectiveEssential,
  buildRecommendation,
};
