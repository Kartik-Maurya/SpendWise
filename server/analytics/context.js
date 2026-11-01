const query = require('../database/query');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function monthKeyOf(month, year) {
  return `${year}-${pad2(month)}`;
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function periodFor(month, year) {
  const now = new Date();
  const today = ymd(now);
  const total = daysInMonth(month, year);
  const start = `${monthKeyOf(month, year)}-01`;
  const end = `${monthKeyOf(month, year)}-${pad2(total)}`;

  let daysElapsed;
  let daysRemaining;
  if (today < start) {
    daysElapsed = 0;
    daysRemaining = total;
  } else if (today > end) {
    daysElapsed = total;
    daysRemaining = 0;
  } else {
    daysElapsed = now.getDate();
    daysRemaining = total - now.getDate() + 1;
  }

  return {
    month: Number(month),
    year: Number(year),
    key: monthKeyOf(month, year),
    start,
    end,
    daysInMonth: total,
    today,
    daysElapsed,
    daysRemaining,
    isCurrent: today >= start && today <= end,
    isPast: today > end,
    isFuture: today < start,
  };
}

function monthsBefore(month, year, count) {
  const months = [];
  let m = Number(month);
  let y = Number(year);
  for (let i = 0; i < count; i += 1) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    months.unshift(periodFor(m, y));
  }
  return months;
}

function historyBefore(transactions, period) {
  return (transactions || []).filter((t) => t.date < period.start);
}

function inPeriod(transactions, period) {
  return (transactions || []).filter((t) => t.date >= period.start && t.date <= period.end);
}

function monthOf(dateString) {
  return String(dateString || '').slice(0, 7);
}

function sumInMonth(transactions, key, category, type) {
  return (transactions || []).reduce((acc, t) => {
    if (monthOf(t.date) !== key) return acc;
    if (type && t.type !== type) return acc;
    if (category && t.category !== category) return acc;
    return acc + Number(t.amount);
  }, 0);
}

function monthlySeries(transactions, periods, category, type = 'expense') {
  return periods.map((p) => sumInMonth(transactions, p.key, category, type));
}

function monthlyTotals(transactions, periods) {
  return periods.map((p) => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (monthOf(t.date) !== p.key) continue;
      if (t.type === 'income') income += Number(t.amount);
      else expense += Number(t.amount);
    }
    return { key: p.key, month: p.month, year: p.year, income, expense };
  });
}

function totalsInPeriod(transactions, period) {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of transactions) {
    if (t.date < period.start || t.date > period.end) continue;
    count += 1;
    if (t.type === 'income') income += Number(t.amount);
    else expense += Number(t.amount);
  }
  return { income, expense, net: income - expense, transactionCount: count };
}

async function loadContext(userId, month, year) {
  const period = periodFor(month, year);
  const [transactions, budgets, plan, recurring] = await Promise.all([
    query.all(
      'SELECT id, type, amount, category, date, is_essential, merchant, recurring_id, description_encrypted FROM transactions WHERE user_id = ? ORDER BY date ASC, id ASC',
      [userId]
    ),
    query.all('SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ?', [
      userId,
      period.month,
      period.year,
    ]),
    query.get('SELECT * FROM plans WHERE user_id = ? AND month = ? AND year = ?', [
      userId,
      period.month,
      period.year,
    ]),
    query.all(
      'SELECT * FROM recurring_transactions WHERE user_id = ? AND is_active = 1 ORDER BY id ASC',
      [userId]
    ),
  ]);

  return {
    userId,
    period,
    transactions: transactions || [],
    budgets: budgets || [],
    plan: plan || null,
    recurring: recurring || [],
  };
}

module.exports = {
  pad2,
  ymd,
  addDays,
  daysBetween,
  monthKeyOf,
  daysInMonth,
  periodFor,
  monthsBefore,
  historyBefore,
  inPeriod,
  monthOf,
  sumInMonth,
  monthlySeries,
  monthlyTotals,
  totalsInPeriod,
  loadContext,
};
