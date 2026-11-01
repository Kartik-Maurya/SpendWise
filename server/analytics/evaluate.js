const { EXPENSE_CATEGORIES } = require('../utils/validation');
const { mean, round2 } = require('./stats');
const { monthsBefore, monthlySeries, historyBefore } = require('./context');
const { backtestSeries } = require('./forecast');
const { buildRecommendation } = require('./reallocate');

function coverageWindow(transactions, period, monthsBack) {
  const observed = [
    ...new Set(
      transactions
        .filter((t) => t.type === 'expense' && t.date < period.start)
        .map((t) => t.date.slice(0, 7))
    ),
  ].sort();

  if (!observed.length) return { count: 0, observed };

  const [firstYear, firstMonth] = observed[0].split('-').map(Number);
  const span = (period.year - firstYear) * 12 + (period.month - firstMonth);
  const count = Math.min(monthsBack, Math.max(0, span));
  return { count, observed };
}

function backtestForecast({ transactions, period, monthsBack = 6 }) {
  const history = historyBefore(transactions, period);
  const window = coverageWindow(history, period, monthsBack);

  if (window.count < 3) {
    return {
      status: 'locked',
      reason: 'A forecast backtest needs at least three completed months of expenses.',
      missing: [`${Math.max(0, 3 - window.count)} more month(s) with expenses`],
      monthsEvaluated: [],
      byCategory: [],
      folds: 0,
      mae: null,
      mape: null,
      naiveMae: null,
      naiveMape: null,
      skill: null,
    };
  }

  const months = monthsBefore(period.month, period.year, window.count);
  const allFolds = [];
  const byCategory = [];

  for (const category of EXPENSE_CATEGORIES) {
    const series = monthlySeries(history, months, category, 'expense');
    if (series.filter((v) => v > 0).length < 2) continue;

    const result = backtestSeries(series);
    if (!result.folds.length) continue;

    for (const fold of result.folds) {
      allFolds.push({ ...fold, category });
    }

    byCategory.push({
      category,
      folds: result.folds.length,
      mae: result.mae,
      mape: result.mape,
      naiveMae: result.naiveMae,
      naiveMape: result.naiveMape,
      skill: result.skill,
    });
  }

  if (!allFolds.length) {
    return {
      status: 'locked',
      reason: 'No category has enough repeated monthly observations to backtest.',
      missing: ['more transactions per category'],
      monthsEvaluated: months.map((m) => m.key),
      byCategory: [],
      folds: 0,
      mae: null,
      mape: null,
      naiveMae: null,
      naiveMape: null,
      skill: null,
    };
  }

  const mae = mean(allFolds.map((f) => f.absError));
  const naiveMae = mean(allFolds.map((f) => f.naiveAbsError));
  const withActual = allFolds.filter((f) => f.actual > 0);
  const mape = withActual.length ? mean(withActual.map((f) => f.absError / f.actual)) : null;
  const naiveMape = withActual.length
    ? mean(withActual.map((f) => f.naiveAbsError / f.actual))
    : null;
  const skill = naiveMae > 0 ? 1 - mae / naiveMae : null;

  return {
    status: 'available',
    method: 'rolling-origin one-step forecast, trained on two or more completed months',
    baseline: 'repeat the most recent month (naive)',
    monthsEvaluated: months.map((m) => m.key),
    folds: allFolds.length,
    mae: round2(mae),
    mape: mape === null ? null : Math.round(mape * 10000) / 10000,
    mapePercent: mape === null ? null : Math.round(mape * 1000) / 10,
    naiveMae: round2(naiveMae),
    naiveMape: naiveMape === null ? null : Math.round(naiveMape * 10000) / 10000,
    naiveMapePercent: naiveMape === null ? null : Math.round(naiveMape * 1000) / 10,
    skill: skill === null ? null : Math.round(skill * 10000) / 10000,
    byCategory,
    assumption: 'forecast = median of the last three months plus a trend capped at 10% per month',
  };
}

function actualByCategory(transactions, period) {
  const map = new Map();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    if (t.date < period.start || t.date > period.end) continue;
    map.set(t.category, (map.get(t.category) || 0) + Number(t.amount));
  }
  const rounded = new Map();
  for (const [category, value] of map) rounded.set(category, round2(value));
  return rounded;
}

function compareAllocation(actuals, allocation) {
  let overrun = 0;
  let within = 0;
  let categories = 0;
  let unbudgeted = 0;

  const keys = new Set([...actuals.keys(), ...allocation.keys()]);
  for (const category of keys) {
    const actual = actuals.get(category) || 0;
    const allocated = allocation.has(category) ? allocation.get(category) : 0;
    if (actual === 0 && allocated === 0) continue;

    categories += 1;
    if (!allocation.has(category)) unbudgeted += actual;

    if (actual <= allocated + 0.01) within += 1;
    else overrun += actual - allocated;
  }

  return {
    overrun: round2(overrun),
    withinBudget: within,
    categories,
    unbudgeted: round2(unbudgeted),
  };
}

function planForMonth(plans, month, year, fallbackObjective) {
  const found = (plans || []).find((p) => p.month === month && p.year === year);
  if (found) return found;
  return {
    month,
    year,
    income_assumption: null,
    savings_target: 0,
    objective: fallbackObjective || 'savings',
  };
}

function budgetsForMonth(budgets, month, year) {
  return (budgets || []).filter((b) => b.month === month && b.year === year);
}

function backtestRecommendations({
  transactions,
  period,
  monthsBack = 6,
  budgets,
  plans,
  recurring,
  objective,
}) {
  const history = historyBefore(transactions, period);
  const window = coverageWindow(history, period, monthsBack);

  if (window.count < 3) {
    return {
      status: 'locked',
      reason: 'A recommendation counterfactual needs at least three completed months.',
      missing: [`${Math.max(0, 3 - window.count)} more month(s) with expenses`],
      monthsEvaluated: 0,
      rows: [],
      totals: null,
      verdict: null,
    };
  }

  const months = monthsBefore(period.month, period.year, Math.min(window.count, monthsBack));
  const rows = [];

  for (const target of months) {
    const actuals = actualByCategory(transactions, target);
    if (!actuals.size) continue;

    const plan = planForMonth(plans, target.month, target.year, objective);
    const recommendation = buildRecommendation({
      transactions,
      budgets: budgetsForMonth(budgets, target.month, target.year),
      plan,
      recurring,
      period: target,
      objective: plan.objective || objective,
    });

    if (recommendation.status !== 'available') {
      rows.push({
        month: target.key,
        status: 'locked',
        reason: recommendation.reason,
        actualTotal: round2([...actuals.values()].reduce((a, v) => a + v, 0)),
      });
      continue;
    }

    const proposed = new Map(recommendation.categories.map((c) => [c.category, c.target]));
    const previous = monthsBefore(target.month, target.year, 1)[0];
    const previousActuals = actualByCategory(transactions, previous);
    const previousTotal = [...previousActuals.values()].reduce((a, v) => a + v, 0);

    const proportional = new Map();
    for (const [category, value] of previousActuals) {
      proportional.set(
        category,
        previousTotal > 0 ? round2((value / previousTotal) * recommendation.envelope) : 0
      );
    }

    const repeatBudgets = budgetsForMonth(budgets, target.month, target.year);
    const repeat = repeatBudgets.length
      ? new Map(repeatBudgets.map((b) => [b.category, Number(b.amount)]))
      : null;

    rows.push({
      month: target.key,
      status: 'evaluated',
      actualTotal: round2([...actuals.values()].reduce((a, v) => a + v, 0)),
      envelope: recommendation.envelope,
      objective: recommendation.objective,
      engine: {
        totalProposed: recommendation.totalProposed,
        ...compareAllocation(actuals, proposed),
      },
      proportional: compareAllocation(actuals, proportional),
      repeat: repeat ? compareAllocation(actuals, repeat) : null,
    });
  }

  const evaluated = rows.filter((r) => r.status === 'evaluated');
  if (!evaluated.length) {
    return {
      status: 'locked',
      reason: 'No month had enough prior history to evaluate a recommendation.',
      missing: ['more history before the evaluated months'],
      monthsEvaluated: 0,
      rows,
      totals: null,
      verdict: null,
    };
  }

  const engineTotal = round2(evaluated.reduce((a, r) => a + r.engine.overrun, 0));
  const proportionalTotal = round2(
    evaluated.reduce((a, r) => a + r.proportional.overrun, 0)
  );
  const repeatRows = evaluated.filter((r) => r.repeat);
  const repeatTotal = repeatRows.length
    ? round2(repeatRows.reduce((a, r) => a + r.repeat.overrun, 0))
    : null;

  let verdict = 'tie';
  if (engineTotal < proportionalTotal - 0.01) verdict = 'engine_lower_overrun';
  else if (engineTotal > proportionalTotal + 0.01) verdict = 'engine_higher_overrun';

  return {
    status: 'available',
    monthsEvaluated: evaluated.length,
    totals: {
      engineOverrun: engineTotal,
      proportionalOverrun: proportionalTotal,
      repeatOverrun: repeatTotal,
      engineMinusProportional: round2(engineTotal - proportionalTotal),
    },
    verdict,
    rows,
    assumptions: [
      'each month is evaluated only with data available before it',
      'the proportional baseline spreads the same envelope by the previous month shares',
      'the repeat baseline reuses that month’s existing budgets when present',
      'current recurring templates are assumed active in all evaluated months',
    ],
  };
}

module.exports = {
  backtestForecast,
  backtestRecommendations,
  actualByCategory,
  compareAllocation,
  coverageWindow,
};
