const { round2 } = require('./stats');

const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };

function rank(level) {
  return CONFIDENCE_RANK[level] || 1;
}

function weaker(a, b) {
  return rank(a) <= rank(b) ? a : b;
}

function confidence(level, reason) {
  return { level, reason };
}

function input(label, value, ref) {
  const entry = { label, value: typeof value === 'number' ? round2(value) : value };
  if (ref) entry.ref = ref;
  return entry;
}

function proof({
  value,
  unit = 'INR',
  method,
  inputs = [],
  assumptions = [],
  confidence: conf,
  trace = {},
}) {
  return {
    value: typeof value === 'number' ? round2(value) : value,
    unit,
    method,
    inputs,
    assumptions,
    confidence: conf || confidence('low', 'not assessed'),
    trace,
    computed_at: new Date().toISOString(),
  };
}

function confidenceFrom({ months = 0, samples = 0, cv = null, mape = null, folds = 0 }) {
  const variation = cv === null || cv === undefined ? null : Number(cv);
  let base = 'low';
  let reason = `${months} month(s), ${samples} observation(s)`;

  if (months >= 5 && samples >= 8 && (variation === null || variation <= 0.4)) {
    base = 'high';
    reason = `${months} months, ${samples} observations, low variation`;
  } else if (months >= 3 && samples >= 4 && (variation === null || variation <= 0.7)) {
    base = 'medium';
    reason = `${months} months, ${samples} observations, moderate variation`;
  } else if (variation !== null && variation > 0.7) {
    reason = `${months} month(s) with high variation (${Math.round(variation * 100)}%)`;
  }

  if (folds > 0 && mape !== null && mape !== undefined) {
    let measured = 'low';
    if (mape <= 0.1) measured = 'high';
    else if (mape <= 0.2) measured = 'medium';
    base = weaker(base, measured);
    reason += `; measured error ${Math.round(mape * 1000) / 10}% over ${folds} fold(s)`;
  }

  return confidence(base, reason);
}

module.exports = {
  rank,
  weaker,
  confidence,
  input,
  proof,
  confidenceFrom,
};
