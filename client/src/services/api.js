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

export const getSpendingByCategory = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/analytics/spending-by-category${qs ? `?${qs}` : ''}`);
};

export const getMonthlySpending = () => apiFetch('/analytics/monthly-spending');

export const getIncomeVsExpenses = () => apiFetch('/analytics/income-vs-expenses');

export const getAnalyticsSummary = () => apiFetch('/analytics/summary');

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

export const exportCsv = async () => {
  const response = await fetch(`${API_BASE}/export/csv`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Export failed');
  }
  return response.blob();
};

export const getAuditLogs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/audit${qs ? `?${qs}` : ''}`);
};
