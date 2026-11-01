const { median, mad, round2 } = require('./stats');
const { addDays } = require('./context');

const MIN_CATEGORY_HISTORY = 5;
const DEFAULT_THRESHOLD = 3.5;

function detectAnomalies({ transactions, period, threshold = DEFAULT_THRESHOLD, maxItems = 10 }) {
  const windowStart = addDays(period.start, -365);
  const history = transactions.filter(
    (t) => t.type === 'expense' && t.date >= windowStart && t.date < period.start
  );
  const current = transactions.filter(
    (t) => t.type === 'expense' && t.date >= period.start && t.date <= period.end
  );

  const byCategory = new Map();
  for (const t of history) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category).push(Number(t.amount));
  }

  let eligibleCategories = 0;
  for (const values of byCategory.values()) {
    if (values.length >= MIN_CATEGORY_HISTORY) eligibleCategories += 1;
  }

  const items = [];
  for (const t of current) {
    const values = byCategory.get(t.category) || [];
    if (values.length < MIN_CATEGORY_HISTORY) continue;

    const center = median(values);
    const deviation = mad(values, center);
    const amount = Number(t.amount);

    let score = null;
    let method = '';
    if (deviation > 0) {
      score = (0.6745 * Math.abs(amount - center)) / deviation;
      method = 'modified z-score using median absolute deviation';
    } else if (center > 0 && amount >= center * 3) {
      score = 99;
      method = 'fixed ratio (history has no variation)';
    }

    if (score === null || score < threshold) continue;

    items.push({
      transaction_id: t.id,
      date: t.date,
      category: t.category,
      amount: round2(amount),
      typical: round2(center),
      mad: round2(deviation),
      score: round2(score),
      direction: amount > center ? 'above' : 'below',
      severity: score >= 5 ? 'high' : 'medium',
      method,
      evidence: {
        categoryHistory: values.length,
        median: round2(center),
        mad: round2(deviation),
        threshold,
      },
    });
  }

  items.sort((a, b) => b.score - a.score);

  return {
    status: eligibleCategories > 0 ? 'available' : 'insufficient_history',
    items: items.slice(0, maxItems),
    total: items.length,
    threshold,
    eligibleCategories,
    historyWindowStart: windowStart,
  };
}

module.exports = {
  detectAnomalies,
  MIN_CATEGORY_HISTORY,
  DEFAULT_THRESHOLD,
};
