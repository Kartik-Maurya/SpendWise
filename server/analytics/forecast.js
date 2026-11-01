const {
  median,
  mean,
  robustSigma,
  theilSenSlope,
  clamp,
  round2,
} = require('./stats');
const { monthsBefore, monthlySeries } = require('./context');
const { proof, input, confidence } = require('./explain');

function forecastSeries(values) {
  const series = (values || []).map(Number);
  const n = series.length;

  if (n === 0) {
    return {
      point: 0,
      low: 0,
      high: 0,
      method: 'no completed months',
      confidence: 'low',
      sampleSize: 0,
      median: 0,
      sigma: 0,
      cv: 0,
      trend: 0,
    };
  }

  if (n === 1) {
    const point = Math.max(0, series[0]);
    return {
      point: round2(point),
      low: 0,
      high: round2(point * 2),
      method: 'single completed month',
      confidence: 'low',
      sampleSize: 1,
      median: round2(point),
      sigma: 0,
      cv: 0,
      trend: 0,
    };
  }

  const recent = series.slice(-3);
  const base = median(recent);

  let trend = 0;
  if (n >= 4) {
    const raw = theilSenSlope(series.slice(-6));
    const cap = Math.abs(base) * 0.1;
    trend = clamp(raw, -cap, cap);
  }

  const point = Math.max(0, base + trend);
  const sigma = robustSigma(series.slice(-6));
  const cv = base > 0 ? sigma / base : 0;

  let level = 'low';
  if (n >= 5 && cv <= 0.35) level = 'high';
  else if (n >= 3 && cv <= 0.7) level = 'medium';

  const parts = [`median of last ${recent.length} completed month${recent.length === 1 ? '' : 's'}`];
  if (Math.abs(trend) > 0.01) {
    parts.push(`${trend > 0 ? '+' : ''}${round2(trend)}/month trend, capped at 10%`);
  }

  return {
    point: round2(point),
    low: round2(Math.max(0, point - 1.28 * sigma)),
    high: round2(point + 1.28 * sigma),
    method: parts.join('; '),
    confidence: level,
    sampleSize: n,
    median: round2(base),
    sigma: round2(sigma),
    cv: round2(cv),
    trend: round2(trend),
  };
}

function backtestSeries(values) {
  const series = (values || []).map(Number);
  const folds = [];

  for (let target = 2; target < series.length; target += 1) {
    const train = series.slice(0, target);
    const actual = series[target];
    const forecast = forecastSeries(train);
    const naive = train[train.length - 1];
    folds.push({
      actual,
      predicted: forecast.point,
      naive,
      absError: Math.abs(actual - forecast.point),
      naiveAbsError: Math.abs(actual - naive),
    });
  }

  if (!folds.length) {
    return { folds: [], mae: null, mape: null, naiveMae: null, naiveMape: null, skill: null };
  }

  const mae = mean(folds.map((f) => f.absError));
  const naiveMae = mean(folds.map((f) => f.naiveAbsError));
  const withActual = folds.filter((f) => f.actual > 0);
  const mape = withActual.length
    ? mean(withActual.map((f) => f.absError / f.actual))
    : null;
  const naiveMape = withActual.length
    ? mean(withActual.map((f) => f.naiveAbsError / f.actual))
    : null;
  const skill = naiveMae > 0 ? 1 - mae / naiveMae : null;

  return {
    folds,
    mae: round2(mae),
    mape: mape === null ? null : Math.round(mape * 10000) / 10000,
    naiveMae: round2(naiveMae),
    naiveMape: naiveMape === null ? null : Math.round(naiveMape * 10000) / 10000,
    skill: skill === null ? null : Math.round(skill * 10000) / 10000,
  };
}

function forecastIncome(history, period, plan) {
  const assumption = plan ? Number(plan.income_assumption) : NaN;
  if (Number.isFinite(assumption) && assumption > 0) {
    return proof({
      value: assumption,
      method: 'planning assumption for this month',
      inputs: [input('income assumption', assumption, 'plan.income_assumption')],
      assumptions: ['explicitly set by the user in the monthly plan'],
      confidence: confidence('high', 'explicit planning input, not estimated'),
      trace: { source: 'plan', month: period.key },
    });
  }

  const months = monthsBefore(period.month, period.year, 6);
  const series = monthlySeries(history, months, null, 'income');
  const active = series.filter((value) => value > 0);

  if (!active.length) return null;

  const forecast = forecastSeries(active);
  const level =
    active.length >= 3 && forecast.cv <= 0.5
      ? forecast.confidence
      : 'low';

  return proof({
    value: forecast.point,
    method: `median of ${active.length} month${active.length === 1 ? '' : 's'} with recorded income`,
    inputs: [
      input('income by month', series.join(', '), 'transactions.type=income'),
      input('uncertainty (80% range)', `${forecast.low} – ${forecast.high}`),
    ],
    assumptions: [
      'months without recorded income are treated as missing, not zero',
      'no guaranteed income is assumed unless the plan sets one',
    ],
    confidence: confidence(level, `${active.length} income months, variation ${Math.round(forecast.cv * 100)}%`),
    trace: {
      month: period.key,
      incomeMonths: active.length,
      low: forecast.low,
      high: forecast.high,
    },
  });
}

module.exports = {
  forecastSeries,
  backtestSeries,
  forecastIncome,
};
