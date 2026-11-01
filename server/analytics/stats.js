function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value, fallback = 0) {
  if (!Number.isFinite(Number(value))) return fallback;
  return Math.round(Number(value) * 100) / 100;
}

function sum(values) {
  return (values || []).reduce((acc, value) => acc + toNumber(value), 0);
}

function mean(values) {
  const list = values || [];
  return list.length ? sum(list) / list.length : 0;
}

function sortedCopy(values) {
  return (values || []).map(toNumber).sort((a, b) => a - b);
}

function quantile(values, q) {
  const sorted = sortedCopy(values);
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function median(values) {
  return quantile(values, 0.5);
}

function mad(values, center) {
  const list = (values || []).map(toNumber);
  if (!list.length) return 0;
  const m = center === undefined ? median(list) : toNumber(center);
  return median(list.map((v) => Math.abs(v - m)));
}

function stddev(values) {
  const list = (values || []).map(toNumber);
  if (list.length < 2) return 0;
  const m = mean(list);
  return Math.sqrt(sum(list.map((v) => (v - m) ** 2)) / (list.length - 1));
}

function robustSigma(values) {
  const list = (values || []).map(toNumber);
  if (!list.length) return 0;
  const m = median(list);
  const deviation = mad(list, m);
  if (deviation > 0) return 1.4826 * deviation;
  return stddev(list);
}

function coefficientOfVariation(values) {
  const list = (values || []).map(toNumber);
  const m = median(list);
  if (m <= 0) return 0;
  return robustSigma(list) / m;
}

function ewma(values, alpha = 0.4) {
  const list = (values || []).map(toNumber);
  if (!list.length) return 0;
  let acc = list[0];
  for (let i = 1; i < list.length; i += 1) {
    acc = alpha * list[i] + (1 - alpha) * acc;
  }
  return acc;
}

function theilSenSlope(values) {
  const list = (values || []).map(toNumber);
  if (list.length < 2) return 0;
  const slopes = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      slopes.push((list[j] - list[i]) / (j - i));
    }
  }
  return median(slopes);
}

function clamp(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
}

module.exports = {
  toNumber,
  round2,
  sum,
  mean,
  quantile,
  median,
  mad,
  stddev,
  robustSigma,
  coefficientOfVariation,
  ewma,
  theilSenSlope,
  clamp,
};
