const { median, round2 } = require('./stats');
const { addDays, daysBetween } = require('./context');

const MONTHLY_FACTOR = {
  weekly: 52 / 12,
  monthly: 1,
  yearly: 1 / 12,
};

function normalizeMonthly(amount, frequency) {
  return Number(amount) * (MONTHLY_FACTOR[frequency] || 1);
}

function committedFromTemplates(recurring) {
  const items = [];
  const byCategory = {};
  let total = 0;

  for (const template of recurring || []) {
    if (template.type !== 'expense') continue;
    const monthly = normalizeMonthly(template.amount, template.frequency);
    total += monthly;
    byCategory[template.category] = (byCategory[template.category] || 0) + monthly;
    items.push({
      recurring_id: template.id,
      category: template.category,
      amount: round2(template.amount),
      frequency: template.frequency,
      monthly: round2(monthly),
      next_occurrence: template.next_occurrence,
    });
  }

  const rounded = {};
  for (const [category, value] of Object.entries(byCategory)) {
    rounded[category] = round2(value);
  }

  return { totalMonthly: round2(total), byCategory: rounded, items };
}

function classifyInterval(gap) {
  if (gap >= 6 && gap <= 8) return 'weekly';
  if (gap >= 25 && gap <= 35) return 'monthly';
  if (gap >= 355 && gap <= 375) return 'yearly';
  return null;
}

function detectSubscriptions(transactions, period, options = {}) {
  const tolerance = options.tolerance || 0.02;
  const windowStart = addDays(period.start, -365);

  const expenses = (transactions || [])
    .filter(
      (t) =>
        t.type === 'expense' &&
        !t.recurring_id &&
        t.date >= windowStart &&
        t.date < period.start
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

  const byCategory = new Map();
  for (const t of expenses) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category).push(t);
  }

  const items = [];

  for (const [category, rows] of byCategory) {
    const clusters = [];
    for (const row of rows) {
      const amount = Number(row.amount);
      const cluster = clusters.find(
        (c) => Math.abs(amount - c.center) / c.center <= tolerance
      );
      if (cluster) {
        cluster.rows.push(row);
        cluster.center = median(cluster.rows.map((r) => Number(r.amount)));
      } else {
        clusters.push({ center: amount, rows: [row] });
      }
    }

    for (const cluster of clusters) {
      if (cluster.rows.length < 2) continue;

      const dates = cluster.rows.map((r) => r.date);
      const gaps = [];
      for (let i = 1; i < dates.length; i += 1) {
        gaps.push(daysBetween(dates[i - 1], dates[i]));
      }

      const gap = median(gaps);
      const frequency = classifyInterval(gap);
      if (!frequency) continue;

      if (gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) > 10) continue;

      const amount = median(cluster.rows.map((r) => Number(r.amount)));
      const occurrences = cluster.rows.length;
      const confidenceLevel = occurrences >= 3 ? 'high' : 'low';

      items.push({
        category,
        amount: round2(amount),
        occurrences,
        intervalDays: Math.round(gap),
        frequency,
        monthlyCost: round2(normalizeMonthly(amount, frequency)),
        lastDate: dates[dates.length - 1],
        confidence: confidenceLevel,
        source: 'detected',
        method: 'amount clustering (±2%) plus interval consistency',
        evidence: {
          gaps,
          tolerance,
          occurrences,
        },
      });
    }
  }

  items.sort((a, b) => b.monthlyCost - a.monthlyCost);
  const totalMonthly = items.reduce((acc, item) => acc + item.monthlyCost, 0);

  return {
    status: items.length ? 'available' : 'none_found',
    items,
    totalMonthly: round2(totalMonthly),
    windowStart,
  };
}

module.exports = {
  MONTHLY_FACTOR,
  normalizeMonthly,
  committedFromTemplates,
  detectSubscriptions,
};
