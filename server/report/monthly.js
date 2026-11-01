const { printCss, printToolbar, printScript } = require('./printKit');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const MASK = '••••••••';
let activePrivacy = false;

function redactCurrency(value) {
  return String(value).replace(/₹\s?-?[\d,]+(?:\.\d+)?/g, MASK);
}

function esc(value) {
  const text = String(value === null || value === undefined ? '' : value);
  return (activePrivacy ? redactCurrency(text) : text).replace(
    /[&<>"']/g,
    (char) => ESCAPES[char]
  );
}

const amountFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function money(value) {
  if (value === null || value === undefined || value === '') return 'n/a';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  if (activePrivacy) return MASK;
  return `₹${amountFormat.format(numeric)}`;
}

function count(value) {
  return amountFormat.format(Number(value) || 0);
}

function periodLabel(period) {
  return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
}

function statusLabel(status) {
  const labels = {
    exceeded: 'Over budget',
    at_risk: 'At risk',
    underspending: 'Underspending',
    on_track: 'On track',
    within_budget: 'Within budget',
    unbudgeted: 'Unbudgeted',
  };
  return labels[status] || status || 'n/a';
}

function badge(text, tone) {
  return `<span class="badge ${esc(tone || 'neutral')}">${esc(text)}</span>`;
}

function details(summary, value) {
  if (value === undefined || value === null) return '';
  if (activePrivacy) {
    return `<p class="meta">Evidence behind ${esc(summary)} is hidden while privacy mode is on.</p>`;
  }
  let body;
  try {
    body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch (err) {
    body = String(value);
  }
  return `<details><summary>${esc(summary)}</summary><pre>${esc(body)}</pre></details>`;
}

function section(title, subtitle, content) {
  return `
    <section class="section">
      <div class="section-head">
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      ${content}
    </section>`;
}

function stat(label, value, note) {
  return `
    <div class="stat">
      <span class="stat-label">${esc(label)}</span>
      <strong>${esc(value)}</strong>
      ${note ? `<span class="stat-note">${esc(note)}</span>` : ''}
    </div>`;
}

function insightsSection(insights) {
  if (!insights || !Array.isArray(insights.items) || insights.items.length === 0) {
    return section(
      'What needs attention',
      'Signals ranked by severity and amount.',
      '<p class="empty">No unusual signals were found for this month.</p>'
    );
  }

  const items = insights.items
    .map(
      (item) => `
      <article class="insight">
        <div class="insight-head">
          ${badge(item.severity, `severity-${item.severity}`)}
          <h3>${esc(item.title)}</h3>
          ${item.amount > 0 ? `<span class="insight-amount">${esc(money(item.amount))}</span>` : ''}
        </div>
        <p>${esc(item.detail)}</p>
        <p class="meta">
          ${item.category ? `Category: ${esc(item.category)} · ` : ''}
          ${item.confidence ? `Confidence: ${esc(item.confidence)} · ` : ''}
          ${item.action && item.action.label ? `Suggested action: ${esc(item.action.label)}` : ''}
        </p>
        ${details('Evidence behind this signal', item.evidence)}
      </article>`
    )
    .join('');

  return section(
    'What needs attention',
    `${insights.total} signal(s), ranked by ${insights.rankedBy || 'severity'}.`,
    `<div class="insights">${items}</div>`
  );
}

function pacingSection(pacing) {
  if (!pacing || !Array.isArray(pacing.rows) || pacing.rows.length === 0) {
    return section('Spending pace', 'Budget against spend for this month.', '<p class="empty">No expense activity was recorded for this month.</p>');
  }

  const rows = pacing.rows
    .map(
      (row) => `
      <tr>
        <td>${esc(row.category)}</td>
        <td class="num">${row.budget === null ? '—' : esc(money(row.budget))}</td>
        <td class="num">${esc(money(row.spent))}</td>
        <td class="num">${esc(money(row.projected))}</td>
        <td class="num ${row.variance > 0 ? 'negative' : row.variance < 0 ? 'positive' : ''}">${
          row.variance === null ? '—' : esc(money(row.variance))
        }</td>
        <td>${badge(statusLabel(row.status), row.status)}</td>
        <td class="meta">${esc(row.method)} · confidence ${esc(row.confidence)}</td>
      </tr>`
    )
    .join('');

  const totals = pacing.totals || {};

  return section(
    'Spending pace',
    'Projected month-end spend uses the median daily rate of prior months, or a linear pace when there is no history.',
    `
    <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="num">Budget</th>
          <th class="num">Spent</th>
          <th class="num">Projected</th>
          <th class="num">Variance</th>
          <th>Status</th>
          <th>Method</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td class="num">${esc(money(totals.budgetTotal || 0))}</td>
          <td class="num">${esc(money(totals.spentTotal || 0))}</td>
          <td class="num">${esc(money(totals.projectedTotal || 0))}</td>
          <td class="num">${totals.varianceTotal === null || totals.varianceTotal === undefined ? '—' : esc(money(totals.varianceTotal))}</td>
          <td colspan="2" class="meta">${totals.overspendNow > 0 ? `${esc(money(totals.overspendNow))} over budget so far` : 'No category is over budget yet'}</td>
        </tr>
      </tfoot>
    </table>
    </div>`
  );
}

function anomaliesSection(anomalies) {
  if (!anomalies || !Array.isArray(anomalies.items) || anomalies.items.length === 0) {
    return section(
      'Unusual transactions',
      'Expenses far above their usual range for the category.',
      '<p class="empty">No transaction stood out from its category baseline.</p>'
    );
  }

  const rows = anomalies.items
    .map(
      (item) => `
      <tr>
        <td>${esc(item.date)}</td>
        <td>${esc(item.category)}</td>
        <td class="num">${esc(money(item.amount))}</td>
        <td class="num">${esc(money(item.typical))}</td>
        <td class="num">${esc(item.score)}</td>
        <td>${badge(item.severity, `severity-${item.severity}`)}</td>
      </tr>`
    )
    .join('');

  return section(
    'Unusual transactions',
    `Compared against a robust baseline (threshold ${esc(anomalies.threshold)}).`,
    `
    <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Date</th><th>Category</th><th class="num">Amount</th><th class="num">Typical</th><th class="num">Score</th><th>Severity</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`
  );
}

function recommendationSection(recommendation) {
  if (!recommendation) {
    return section('Rebalance proposal', 'How next month could be budgeted.', '<p class="empty">No recommendation was computed.</p>');
  }

  if (recommendation.status !== 'available') {
    return section(
      'Rebalance proposal',
      'How next month could be budgeted.',
      `<p class="empty">${esc(recommendation.reason || 'Not enough evidence yet.')}</p>
       ${Array.isArray(recommendation.missing) && recommendation.missing.length ? `<ul class="notes">${recommendation.missing.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}`
    );
  }

  const rows = recommendation.categories
    .map((item) => {
      const evidence = {
        monthlySeries: item.evidence && item.evidence.monthlySeries,
        forecast: item.evidence && item.evidence.forecast,
        floorBasis: item.evidence && item.evidence.floorBasis,
        capBasis: item.evidence && item.evidence.capBasis,
        essentialSource: item.essentialSource,
        stabilityLimited: item.evidence && item.evidence.stabilityLimited,
        stabilityBound: item.evidence && item.evidence.stabilityBound,
        stabilityLimit: item.evidence && item.evidence.stabilityLimit,
        targetBeforeStability: item.evidence && item.evidence.targetBeforeStability,
      };
      return `
      <tr>
        <td>
          ${esc(item.category)} ${item.essential ? badge('essential', 'neutral') : ''}
          <div class="meta">${esc(item.reason)}</div>
          ${details('Category evidence', evidence)}
        </td>
        <td class="num">${item.currentBudget === null ? '—' : esc(money(item.currentBudget))}</td>
        <td class="num"><strong>${esc(money(item.target))}</strong></td>
        <td class="num ${item.delta > 0 ? 'negative' : item.delta < 0 ? 'positive' : ''}">${
          item.delta === 0 ? '—' : esc(money(item.delta))
        }</td>
        <td class="num">${esc(money(item.floor))}</td>
        <td class="num">${esc(money(item.cap))}</td>
        <td>${esc(item.confidence)}</td>
      </tr>`;
    })
    .join('');

  const notes = Array.isArray(recommendation.notes) && recommendation.notes.length
    ? `<ul class="notes">${recommendation.notes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul>`
    : '';

  return section(
    'Rebalance proposal',
    `Objective: ${recommendation.objective === 'overrun' ? 'avoid overruns' : 'save more'}. Targets are held within 20% of current budgets where they exist.`,
    `
    <div class="stat-row">
      ${stat('Envelope', money(recommendation.envelope), 'income estimate minus savings target')}
      ${stat('Current budgets', money(recommendation.totalCurrent))}
      ${stat('Proposed budgets', money(recommendation.totalProposed))}
      ${stat(
        'Extra savings',
        money(recommendation.extraSavings),
        recommendation.feasible ? 'left unallocated by lean targets' : `floors exceed the envelope by ${money(recommendation.deficit)}`
      )}
    </div>
    ${notes}
    <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Category and reason</th>
          <th class="num">Current</th>
          <th class="num">Proposed</th>
          <th class="num">Change</th>
          <th class="num">Floor</th>
          <th class="num">Cap</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`
  );
}

function recurrenceSection(committed, detected) {
  const committedItems = (committed && committed.items) || [];
  const detectedItems = (detected && detected.items) || [];

  if (!committedItems.length && !detectedItems.length) {
    return section(
      'Committed spending',
      'Recurring templates and repeat charges detected from history.',
      '<p class="empty">No recurring charges were found.</p>'
    );
  }

  const committedRows = committedItems
    .map(
      (item) => `
      <tr>
        <td>${esc(item.category)}</td>
        <td class="num">${esc(money(item.amount))}</td>
        <td>${esc(item.frequency)}</td>
        <td class="num">${esc(money(item.monthly))}</td>
        <td>${esc(item.next_occurrence)}</td>
      </tr>`
    )
    .join('');

  const detectedRows = detectedItems
    .map(
      (item) => `
      <tr>
        <td>${esc(item.category)}</td>
        <td class="num">${esc(money(item.amount))}</td>
        <td class="num">${esc(item.occurrences)}</td>
        <td>${esc(item.frequency)}</td>
        <td class="num">${esc(money(item.monthlyCost))}</td>
        <td class="meta">${esc(item.method)} · confidence ${esc(item.confidence)}</td>
      </tr>`
    )
    .join('');

  return section(
    'Committed spending',
    'Fixed costs come out before any discretionary budget.',
    `
    <div class="stat-row">
      ${stat('Recurring templates', money(committed ? committed.totalMonthly : 0), 'per month')}
      ${stat('Detected repeat charges', money(detected ? detected.totalMonthly : 0), 'per month')}
    </div>
    ${
      committedItems.length
        ? `<h3 class="subhead">Active recurring templates</h3>
           <div class="table-wrap">
           <table>
             <thead><tr><th>Category</th><th class="num">Amount</th><th>Frequency</th><th class="num">Monthly cost</th><th>Next occurrence</th></tr></thead>
             <tbody>${committedRows}</tbody>
           </table>
           </div>`
        : ''
    }
    ${
      detectedItems.length
        ? `<h3 class="subhead">Repeat charges detected from history</h3>
           <div class="table-wrap">
           <table>
             <thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Occurrences</th><th>Frequency</th><th class="num">Monthly cost</th><th>Method</th></tr></thead>
             <tbody>${detectedRows}</tbody>
           </table>
           </div>`
        : ''
    }`
  );
}

function planSection(data) {
  const plan = data.ctx.plan;
  const income = data.income;
  const assumptions = Array.isArray(income && income.assumptions) ? income.assumptions : [];

  return section(
    'Plan and assumptions',
    'What the analysis assumed, so every number can be checked.',
    `
    <div class="stat-row">
      ${stat('Objective', plan ? (plan.objective === 'overrun' ? 'Avoid overruns' : 'Save more') : 'Not set')}
      ${stat('Savings target', money(plan && plan.savings_target))}
      ${stat('Income assumption', plan && plan.income_assumption !== null ? money(plan.income_assumption) : 'From recorded income')}
      ${stat('Income used', money(income && income.value), income ? income.method : 'No estimate')}
    </div>
    ${
      assumptions.length
        ? `<ul class="notes">${assumptions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
        : ''
    }
    ${details('Income proof', income)}
    <p class="meta">
      Analysis depth: tier ${esc(data.coverage.tier.level)} (${esc(data.coverage.tier.label)}) ·
      ${esc(data.coverage.expenseMonths)} completed month(s) with expenses ·
      ${esc(count(data.coverage.totalTransactions))} transaction(s) observed.
    </p>`
  );
}

function buildReport({ user, data, generatedAt = new Date() }) {
  const period = data.ctx.period;
  const totals = data.totals;
  const safe = data.safeToSpend || {};
  const closed = !period.isCurrent;

  const heroTiles = [
    stat('Income used', money(data.income && data.income.value), data.income ? data.income.method : 'No estimate'),
    stat('Expenses', money(totals.expense), `${count(totals.transactionCount)} transaction(s)`),
    stat('Net', money(totals.net), totals.net >= 0 ? 'surplus' : 'deficit'),
    closed
      ? stat('Savings target', money(safe.savings && safe.savings.target), safe.savings ? 'closed month' : 'not set')
      : stat('Safe to spend', `${money(safe.value)}/day`, `${safe.daysRemaining} day(s) remaining`),
  ].join('');

  const safeRow = closed
    ? ''
    : `<div class="stat-row">
        ${stat('Available now', money(safe.available), 'after committed charges')}
        ${stat('Committed remaining', money(safe.committedRemaining), 'upcoming recurring charges')}
        ${stat(
          'Savings',
          safe.savings && safe.savings.projected !== null ? money(safe.savings.projected) : 'n/a',
          safe.savings ? `target ${money(safe.savings.target)}` : 'no target set'
        )}
      </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SpendWise monthly report · ${esc(periodLabel(period))}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 16px 56px;
    background: #eef1f5;
    color: #172033;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .sheet {
    max-width: 980px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
    padding: 40px 44px 36px;
  }
  .report-head { display: flex; gap: 24px; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e6eaf0; padding-bottom: 22px; }
  .brand { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #0f766e; }
  h1 { font-size: 30px; line-height: 1.15; margin: 6px 0 4px; letter-spacing: -0.02em; }
  .lede { margin: 0; color: #5b667a; }
  .head-side { text-align: right; font-size: 12px; color: #5b667a; white-space: nowrap; }
  .head-side strong { display: block; color: #172033; font-size: 14px; }
  .privacy-flag { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; }
  .section { margin-top: 30px; }
  .section-head { margin-bottom: 12px; }
  .section-head h2 { font-size: 18px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .section-head p { margin: 0; color: #65708a; font-size: 12.5px; }
  .subhead { font-size: 14px; margin: 18px 0 8px; color: #334155; }
  .stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 4px 0 14px; }
  .stat { border: 1px solid #e6eaf0; background: #f8fafc; border-radius: 10px; padding: 12px 14px; }
  .stat-label { display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #65708a; }
  .stat strong { display: block; font-size: 19px; margin-top: 3px; letter-spacing: -0.01em; }
  .stat-note { display: block; font-size: 11.5px; color: #7a8499; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .table-wrap { width: 100%; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e9edf3; vertical-align: top; }
  th { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #65708a; background: #f8fafc; }
  tfoot td { font-weight: 700; background: #f8fafc; border-bottom: 0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .positive { color: #047857; }
  .negative { color: #b91c1c; }
  .meta { color: #7a8499; font-size: 11.5px; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
  .badge.neutral, .badge.severity-info { background: #eef2f7; color: #475569; }
  .badge.severity-low { background: #ecfdf5; color: #047857; }
  .badge.severity-medium, .badge.at_risk, .badge.underspending { background: #fffbeb; color: #b45309; }
  .badge.severity-high, .badge.exceeded { background: #fef2f2; color: #b91c1c; }
  .badge.on_track, .badge.within_budget { background: #ecfdf5; color: #047857; }
  .badge.unbudgeted { background: #f1f5f9; color: #475569; }
  .insights { display: grid; gap: 10px; }
  .insight { border: 1px solid #e6eaf0; border-radius: 10px; padding: 12px 14px; break-inside: avoid; }
  .insight-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .insight-head h3 { font-size: 14.5px; margin: 0; flex: 1; }
  .insight-amount { font-weight: 700; font-variant-numeric: tabular-nums; }
  .insight p { margin: 6px 0 0; }
  .empty { color: #7a8499; margin: 6px 0 0; }
  .notes { margin: 6px 0 12px; padding-left: 20px; color: #475569; }
  details { margin-top: 8px; }
  summary { cursor: pointer; font-size: 11.5px; color: #0f766e; font-weight: 600; }
  pre { margin: 8px 0 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #e6eaf0; border-radius: 8px; font-size: 11px; line-height: 1.45; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
  .footer { margin-top: 34px; border-top: 2px solid #e6eaf0; padding-top: 16px; color: #7a8499; font-size: 11.5px; }
  .footer p { margin: 4px 0; }
  @media screen and (max-width: 760px) {
    body { padding: 12px 8px 32px; }
    .sheet { padding: 22px 18px; }
    .report-head { flex-direction: column; gap: 12px; }
    .head-side { text-align: left; white-space: normal; }
    .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    th, td { padding: 7px 6px; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-wrap table { min-width: 760px; }
  }
  ${printCss()}
</style>
</head>
<body>
<main class="sheet">
  <header class="report-head">
    <div>
      <div class="brand">SpendWise · Monthly report</div>
      <h1>${esc(periodLabel(period))}</h1>
      <p class="lede">${esc(user && user.name ? user.name : 'Your account')} · ${
        closed ? 'Completed month review' : 'Month in progress'
      }</p>
    </div>
    <div class="head-side">
      <strong>Generated ${esc(generatedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</strong>
      <span>Analysis tier ${esc(data.coverage.tier.level)} · ${esc(data.coverage.tier.label)}</span>
      ${activePrivacy ? '<span class="privacy-flag">Privacy mode · amounts hidden</span>' : ''}
    </div>
  </header>

  ${printToolbar()}

  <section class="section">
    <div class="section-head">
      <h2>At a glance</h2>
      <p>Totals use the transactions recorded for ${esc(periodLabel(period))}${closed ? '' : ', with projections to month end'}.</p>
    </div>
    <div class="stat-row">${heroTiles}</div>
    ${safeRow}
  </section>

  ${insightsSection(data.insights)}
  ${pacingSection(data.pacing)}
  ${anomaliesSection(data.anomalies)}
  ${recommendationSection(data.recommendation)}
  ${recurrenceSection(data.committed, data.detected)}
  ${planSection(data)}

  <footer class="footer">
    <p><strong>How to check these numbers.</strong> Every figure is computed from this account's transactions, budgets and plan. The Analytics page shows the same inputs, method and trace behind each number in its proof drawer.</p>
    <p>Projections are estimates, not guarantees. Confidence reflects how many months of history support the number and how much the category varies.</p>
    <p>Generating this report is recorded in the audit log as a report export.</p>
  </footer>
</main>
${printScript()}
</body>
</html>`;
}

function buildMonthlyReport({ user, data, generatedAt = new Date(), privacy = false }) {
  const previous = activePrivacy;
  activePrivacy = Boolean(privacy);
  try {
    return buildReport({ user, data, generatedAt });
  } finally {
    activePrivacy = previous;
  }
}

module.exports = {
  buildMonthlyReport,
  money,
  esc,
  periodLabel,
};
