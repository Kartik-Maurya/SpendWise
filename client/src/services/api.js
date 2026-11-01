const API_BASE = '/api';

let authErrorHandler = null;

export function setAuthErrorHandler(handler) {
  authErrorHandler = handler;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 401 && authErrorHandler) {
    authErrorHandler();
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: 'Request failed' };
    }
    const err = new Error(errorData.error || 'Request failed');
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  return response.json();
}

export const login = (email, password) =>
  apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const register = (name, email, password, confirmPassword) =>
  apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword }) });

export const logout = () => apiFetch('/auth/logout', { method: 'POST' });

export const getMe = () => apiFetch('/auth/me');

export const changePassword = (currentPassword, newPassword, confirmPassword) =>
  apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });

export const forgotPassword = (email) =>
  apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

export const resetPassword = (token, newPassword, confirmPassword) =>
  apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  });

export const getTransactions = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/transactions${qs ? `?${qs}` : ''}`);
};

export const getTransactionById = (id) => apiFetch(`/transactions/${id}`);

export const getSummary = () => apiFetch('/transactions/summary');

export const createTransaction = (transaction) =>
  apiFetch('/transactions', { method: 'POST', body: JSON.stringify(transaction) });

export const updateTransaction = (id, transaction) =>
  apiFetch(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(transaction) });

export const deleteTransaction = (id) =>
  apiFetch(`/transactions/${id}`, { method: 'DELETE' });

export const bulkUpdateTransactions = (payload) =>
  apiFetch('/transactions/bulk', { method: 'PATCH', body: JSON.stringify(payload) });

export const bulkDeleteTransactions = (ids) =>
  apiFetch('/transactions/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });

export const importTransactions = (csv) =>
  apiFetch('/transactions/import', { method: 'POST', body: JSON.stringify({ csv }) });

export const importRecurring = (csv) =>
  apiFetch('/recurring/import', { method: 'POST', body: JSON.stringify({ csv }) });

export const importBudgets = (csv) =>
  apiFetch('/budgets/import', { method: 'POST', body: JSON.stringify({ csv }) });

export const previewFileImport = (payload) =>
  apiFetch('/import/preview', { method: 'POST', body: JSON.stringify(payload) });

export const commitFileImport = (payload) =>
  apiFetch('/import/commit', { method: 'POST', body: JSON.stringify(payload) });

export const getSpendingByCategory = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/spending-by-category${qs ? `?${qs}` : ''}`);
};

export const getMonthlySpending = () => apiFetch('/analytics/monthly-spending');

export const getIncomeVsExpenses = () => apiFetch('/analytics/income-vs-expenses');

export const getAnalyticsSummary = () => apiFetch('/analytics/summary');

export const getAnalyticsOverview = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/overview${qs ? `?${qs}` : ''}`);
};

export const getAnalyticsInsights = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/insights${qs ? `?${qs}` : ''}`);
};

export const getRecommendations = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/recommendations${qs ? `?${qs}` : ''}`);
};

export const applyRecommendations = (payload) =>
  apiFetch('/analytics/recommendations/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getAnalyticsPlan = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/plan${qs ? `?${qs}` : ''}`);
};

export const updateAnalyticsPlan = (plan) =>
  apiFetch('/analytics/plan', { method: 'PUT', body: JSON.stringify(plan) });

export const getAnalyticsBacktest = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/backtest${qs ? `?${qs}` : ''}`);
};

export const getBudgets = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/budgets${qs ? `?${qs}` : ''}`);
};

export const getBudgetById = (id) => apiFetch(`/budgets/${id}`);

export const createBudget = (budget) =>
  apiFetch('/budgets', { method: 'POST', body: JSON.stringify(budget) });

export const updateBudget = (id, budget) =>
  apiFetch(`/budgets/${id}`, { method: 'PUT', body: JSON.stringify(budget) });

export const deleteBudget = (id) =>
  apiFetch(`/budgets/${id}`, { method: 'DELETE' });

export const getBudgetWarnings = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/budgets/warnings${qs ? `?${qs}` : ''}`);
};

export const getRecurringTransactions = () => apiFetch('/recurring');

export const getRecurringById = (id) => apiFetch(`/recurring/${id}`);

export const createRecurring = (recurring) =>
  apiFetch('/recurring', { method: 'POST', body: JSON.stringify(recurring) });

export const updateRecurring = (id, recurring) =>
  apiFetch(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(recurring) });

export const deleteRecurring = (id) =>
  apiFetch(`/recurring/${id}`, { method: 'DELETE' });

export const bulkUpdateRecurring = (payload) =>
  apiFetch('/recurring/bulk', { method: 'PATCH', body: JSON.stringify(payload) });

export const bulkDeleteRecurring = (ids) =>
  apiFetch('/recurring/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch (err) {
      // fall through to the plain filename
    }
  }

  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted) return quoted[1];

  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

async function downloadFile(path, fallbackName) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch (err) {
      data = { error: 'Export failed' };
    }
    const error = new Error(data.error || 'Export failed');
    error.status = response.status;
    throw error;
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(
      response.headers.get('content-disposition'),
      fallbackName
    ),
  };
}

export const downloadDatasetCsv = (dataset, privacy = false) => {
  const params = new URLSearchParams({ dataset });
  if (privacy) params.set('privacy', '1');
  return downloadFile(
    `/export/csv?${params.toString()}`,
    `spendwise-${dataset}.csv`
  );
};

export const downloadBackup = (privacy = false) =>
  downloadFile(
    `/export/backup${privacy ? '?privacy=1' : ''}`,
    'spendwise-backup.json'
  );

export const downloadWorkbook = (privacy = false) =>
  downloadFile(
    `/export/workbook${privacy ? '?privacy=1' : ''}`,
    'spendwise-data.xlsx'
  );

export const getReportUrl = (month, year, privacy = false) => {
  const params = { month, year };
  if (privacy) params.privacy = 1;
  const qs = new URLSearchParams(params).toString();
  return `${API_BASE}/export/report?${qs}`;
};

export const getAuditLogs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/audit${qs ? `?${qs}` : ''}`);
};

export const getRecommendationTrail = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/audit/recommendations${qs ? `?${qs}` : ''}`);
};

export const downloadAuditCsv = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return downloadFile(`/audit/export${qs ? `?${qs}` : ''}`, 'spendwise-audit-log.csv');
};

export const getDemoStatus = () => apiFetch('/demo');

export const loadDemoData = () => apiFetch('/demo', { method: 'POST' });

export const purgeDemoData = () =>
  apiFetch('/demo', { method: 'DELETE', body: JSON.stringify({ confirm: true }) });
