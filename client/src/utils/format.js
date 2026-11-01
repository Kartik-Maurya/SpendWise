
export function todayInputValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactCurrency(amount) {
  if (amount === null || amount === undefined) return '';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '';

  const sign = numeric < 0 ? '-' : '';
  const absolute = Math.abs(numeric);
  const trim = (value) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  if (absolute >= 1e7) return `${sign}₹${trim(absolute / 1e7)}C`;
  if (absolute >= 1e5) return `${sign}₹${trim(absolute / 1e5)}L`;
  if (absolute >= 1e3) return `${sign}₹${trim(absolute / 1e3)}K`;
  return `${sign}₹${Math.round(absolute)}`;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const categories = {
  income: ['Salary', 'Freelance', 'Investment', 'Other Income'],
  expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Education', 'Health', 'Other'],
};

export function getCategoryType(category) {
  if (categories.income.includes(category)) return 'income';
  if (categories.expense.includes(category)) return 'expense';
  return 'expense';
}
