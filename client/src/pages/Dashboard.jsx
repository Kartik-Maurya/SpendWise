import React, { lazy, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard.jsx';
import BudgetCard from '../components/BudgetCard.jsx';
import BudgetWarningCard from '../components/BudgetWarningCard.jsx';
import PrivacyAmount from '../components/PrivacyAmount.jsx';
import InfoHint from '../components/InfoHint.jsx';
import ChartModal from '../components/ChartModal.jsx';
import ChartDataTable from '../components/ChartDataTable.jsx';
import ChartSlot from '../components/charts/ChartSlot.jsx';

const MonthlyTrendChart = lazy(() => import('../components/charts/MonthlyTrendChart.jsx'));
const IncomeExpenseBars = lazy(() => import('../components/charts/IncomeExpenseBars.jsx'));
const CategoryDonut = lazy(() => import('../components/charts/CategoryDonut.jsx'));
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDate } from '../utils/format.js';
import { showNotification } from '../components/Notification.jsx';
import {
  getSummary,
  getTransactions,
  getSpendingByCategory,
  getMonthlySpending,
  getAnalyticsSummary,
  getBudgets,
  getBudgetWarnings,
  getDemoStatus,
  loadDemoData,
} from '../services/api.js';

export default function Dashboard({ refreshToken }) {
  const { formatAmount, formatDescription, privacyMode } = usePrivacyFormat();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedChart, setExpandedChart] = useState(null);
  const [dataView, setDataView] = useState(null);
  const [demoStatus, setDemoStatus] = useState(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);

  const demoDismissKey = user ? `spendwise.demo-banner-dismissed.${user.id}` : null;

  useEffect(() => {
    loadData();
  }, [refreshToken]);

  useEffect(() => {
    if (!demoDismissKey) return;
    setDemoDismissed(window.localStorage.getItem(demoDismissKey) === '1');
  }, [demoDismissKey]);

  useEffect(() => {
    if (loading || !summary || summary.transactionCount !== 0 || demoStatus) return;
    getDemoStatus()
      .then(setDemoStatus)
      .catch(() => {});
  }, [loading, summary, demoStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        getSummary(),
        getTransactions(),
        getSpendingByCategory(),
        getMonthlySpending(),
        getAnalyticsSummary(),
        getBudgets(),
        getBudgetWarnings(),
      ]);

      const [summaryData, txData, catData, monthData, analyticsData, budgetsData, warningsData] =
        results.map((r) => (r.status === 'fulfilled' ? r.value : null));

      setSummary(summaryData || { income: 0, expense: 0, balance: 0, transactionCount: 0 });
      setRecentTransactions(txData?.slice(0, 5) || []);
      setCategoryData(catData || []);
      setMonthlyData(monthData || []);
      setAnalyticsSummary(analyticsData || null);
      setBudgets(budgetsData || []);
      setWarnings(warningsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      showNotification('error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const dismissDemoBanner = () => {
    setDemoDismissed(true);
    if (demoDismissKey) {
      window.localStorage.setItem(demoDismissKey, '1');
    }
  };

  const handleLoadDemo = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const result = await loadDemoData();
      setDemoStatus(result.status);
      await loadData();
      showNotification(
        'success',
        `Demo data loaded: ${result.loaded.transactions} transactions across ${result.status.months} months.`
      );
    } catch (err) {
      showNotification('error', err.message || 'Failed to load demo data');
    } finally {
      setDemoBusy(false);
    }
  };

  if (loading && !summary) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const pieData = categoryData.length > 0
    ? (() => {
        const total = categoryData.reduce((sum, d) => sum + d.amount, 0) || 1;
        return categoryData.map((d) => ({
          name: d.category,
          value: d.amount,
          percent: Math.round((d.amount / total) * 100),
        }));
      })()
    : [{ name: 'No data', value: 1, percent: 100 }];

  const recentMonths = monthlyData.slice(-6);
  const monthColumns = [
    { key: 'month', label: 'Month' },
    { key: 'income', label: 'Income', align: 'right', render: (row) => formatAmount(row.income) },
    { key: 'expenses', label: 'Expenses', align: 'right', render: (row) => formatAmount(row.expenses) },
  ];
  const categoryColumns = [
    { key: 'name', label: 'Category' },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatAmount(row.value) },
    { key: 'percent', label: 'Share', align: 'right', render: (row) => `${row.percent}%` },
  ];
  const toggleDataView = (view) => setDataView((current) => (current === view ? null : view));
  const showDemoBanner =
    !loading &&
    summary &&
    summary.transactionCount === 0 &&
    demoStatus &&
    !demoStatus.active &&
    !demoDismissed;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="page-subtitle">Your money at a glance, with the latest activity.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/analytics')}>
          View Analytics
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showDemoBanner && (
        <div className="demo-banner">
          <div className="demo-banner-main">
            <strong>See SpendWise with six months of data</strong>
            <p>
              Load a tagged demo history to explore charts, budgets, insights and recommendations.
              Remove it whenever you like; entries you create are never touched.
            </p>
          </div>
          <div className="demo-banner-actions">
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={handleLoadDemo}
              disabled={demoBusy}
            >
              {demoBusy ? 'Loading…' : 'Load demo data'}
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={dismissDemoBanner}>
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="Balance"
          value={summary.balance}
          type="balance"
          icon="💰"
          hint="Income minus expenses across all recorded transactions."
        />
        <StatCard
          label="Income"
          value={summary.income}
          type="income"
          icon="📈"
          hint="Every income transaction recorded so far."
        />
        <StatCard
          label="Expenses"
          value={summary.expense}
          type="expense"
          icon="📉"
          hint="Every expense transaction recorded so far."
        />
        <StatCard
          label="Transactions"
          value={summary.transactionCount}
          type="transactions"
          icon="📋"
          isCurrency={false}
          hint="How many income and expense entries exist in total."
        />
      </div>

      <div className="dashboard-charts">
        <div className={`chart-container${dataView === 'monthly' ? ' table-open' : ''}`}>
          <div className="chart-head">
            <h3>
              Monthly Spending
              <InfoHint label="About the monthly spending chart">
                Expenses and income by month. The shaded areas show the trend; hover a month for
                exact amounts.
              </InfoHint>
            </h3>
            <div className="chart-actions">
              <button
                type="button"
                className="chart-expand"
                onClick={() => toggleDataView('monthly')}
                aria-expanded={dataView === 'monthly'}
                aria-controls="monthly-chart-data"
                aria-label={
                  dataView === 'monthly'
                    ? 'Show monthly spending chart'
                    : 'Show monthly spending data table'
                }
                title={dataView === 'monthly' ? 'Show chart' : 'Data table'}
                data-icon="▦"
                disabled={monthlyData.length === 0}
              >
                {dataView === 'monthly' ? 'Show chart' : 'Data table'}
              </button>
              <button
                type="button"
                className="chart-expand"
                onClick={() => setExpandedChart('monthly')}
                aria-label="Expand monthly spending chart"
                title="Expand"
                data-icon="⤢"
                disabled={monthlyData.length === 0}
              >
                Expand
              </button>
            </div>
          </div>
          {monthlyData.length > 0 ? (
            <>
              <div className="chart-view" hidden={dataView === 'monthly'}>
                <ChartSlot height={190}>
                  <MonthlyTrendChart
                    data={recentMonths}
                    privacyMode={privacyMode}
                    formatAmount={formatAmount}
                  />
                </ChartSlot>
              </div>
              <ChartDataTable
                id="monthly-chart-data"
                caption="Monthly income and expenses, six most recent months"
                columns={monthColumns}
                rows={recentMonths}
                hidden={dataView !== 'monthly'}
              />
            </>
          ) : (
            <div className="chart-empty">No monthly data yet</div>
          )}
        </div>

        <div className={`chart-container${dataView === 'income' ? ' table-open' : ''}`}>
          <div className="chart-head">
            <h3>
              Income vs Expenses
              <InfoHint label="About the income vs expenses chart">
                The six most recent months with activity. Each pair of bars compares what came in
                with what went out; hover a bar for exact amounts.
              </InfoHint>
            </h3>
            <div className="chart-actions">
              <button
                type="button"
                className="chart-expand"
                onClick={() => toggleDataView('income')}
                aria-expanded={dataView === 'income'}
                aria-controls="income-chart-data"
                aria-label={
                  dataView === 'income'
                    ? 'Show income vs expenses chart'
                    : 'Show income vs expenses data table'
                }
                title={dataView === 'income' ? 'Show chart' : 'Data table'}
                data-icon="▦"
                disabled={monthlyData.length === 0}
              >
                {dataView === 'income' ? 'Show chart' : 'Data table'}
              </button>
              <button
                type="button"
                className="chart-expand"
                onClick={() => setExpandedChart('income')}
                aria-label="Expand income vs expenses chart"
                title="Expand"
                data-icon="⤢"
                disabled={monthlyData.length === 0}
              >
                Expand
              </button>
            </div>
          </div>
          {monthlyData.length > 0 ? (
            <>
              <div className="chart-view" hidden={dataView === 'income'}>
                <ChartSlot height={190}>
                  <IncomeExpenseBars
                    data={recentMonths}
                    privacyMode={privacyMode}
                    formatAmount={formatAmount}
                  />
                </ChartSlot>
              </div>
              <ChartDataTable
                id="income-chart-data"
                caption="Monthly income and expenses, six most recent months"
                columns={monthColumns}
                rows={recentMonths}
                hidden={dataView !== 'income'}
              />
            </>
          ) : (
            <div className="chart-empty">No data yet</div>
          )}
        </div>

        <div className={`chart-container${dataView === 'category' ? ' table-open' : ''}`}>
          <div className="chart-head">
            <h3>
              Spending by Category
              <InfoHint label="About the category chart">
                Each slice is a share of total expenses. Hover a slice for the exact amount.
              </InfoHint>
            </h3>
            <div className="chart-actions">
              <button
                type="button"
                className="chart-expand"
                onClick={() => toggleDataView('category')}
                aria-expanded={dataView === 'category'}
                aria-controls="category-chart-data"
                aria-label={
                  dataView === 'category'
                    ? 'Show spending by category chart'
                    : 'Show spending by category data table'
                }
                title={dataView === 'category' ? 'Show chart' : 'Data table'}
                data-icon="▦"
                disabled={categoryData.length === 0}
              >
                {dataView === 'category' ? 'Show chart' : 'Data table'}
              </button>
              <button
                type="button"
                className="chart-expand"
                onClick={() => setExpandedChart('category')}
                aria-label="Expand spending by category chart"
                title="Expand"
                data-icon="⤢"
                disabled={categoryData.length === 0}
              >
                Expand
              </button>
            </div>
          </div>
          {categoryData.length > 0 ? (
            <>
              <div className="chart-view" hidden={dataView === 'category'}>
                <ChartSlot height={160}>
                  <CategoryDonut data={pieData} formatAmount={formatAmount} />
                </ChartSlot>
              </div>
              <ChartDataTable
                id="category-chart-data"
                caption="Spending by category"
                columns={categoryColumns}
                rows={pieData}
                hidden={dataView !== 'category'}
              />
            </>
          ) : (
            <div className="chart-empty">No expense data</div>
          )}
        </div>
      </div>

      {budgets.length > 0 && (
        <div className="dashboard-section">
          <div className="section-header">
            <h3>Budget Overview</h3>
            <button className="btn btn-secondary btn-small" onClick={() => navigate('/budgets')}>
              Manage Budgets
            </button>
          </div>
          <div className="budget-grid">
            {budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} showActions={false} />
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="dashboard-section">
          <h3>Budget Warnings</h3>
          <div className="warnings-list">
            {warnings.map((w) => (
              <BudgetWarningCard key={w.budget_id} warning={w} />
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Recent Transactions</h3>
          <button className="btn btn-secondary btn-small" onClick={() => navigate('/transactions')}>
            View All
          </button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="empty-state">No transactions yet. Add your first transaction!</div>
        ) : (
          <div className="transaction-list">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-card compact">
                <div className="transaction-header">
                  <span className={`transaction-type ${transaction.type}`}>
                    {transaction.type === 'income' ? '↑ Income' : '↓ Expense'}
                  </span>
                   <span className={`transaction-amount ${transaction.type}`}>
                     <PrivacyAmount amount={transaction.amount} prefix={transaction.type === 'income' ? '+' : '-'} />
                   </span>
                </div>
                <div className="transaction-body">
                  <div className="transaction-details">
                    <div className="transaction-category">{transaction.category}</div>
                    {transaction.description && (
                      <div className="transaction-description">
                        {formatDescription(transaction.description)}
                      </div>
                    )}
                    <div className="transaction-date">{formatDate(transaction.date)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analyticsSummary && (
        <div className="dashboard-section">
          <h3>Monthly Summary</h3>
          <div className="analytics-summary-grid">
            <div className="summary-item">
              <span className="summary-label">Highest Spending Category</span>
              <span className="summary-value">{analyticsSummary.highestSpendingCategory || 'N/A'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Spending This Month</span>
               <span className="summary-value">{formatAmount(analyticsSummary.totalSpendingThisMonth)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Income This Month</span>
               <span className="summary-value">{formatAmount(analyticsSummary.totalIncomeThisMonth)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Net Savings This Month</span>
              <span className={`summary-value ${analyticsSummary.netSavingsThisMonth >= 0 ? 'positive' : 'negative'}`}>
                 {formatAmount(analyticsSummary.netSavingsThisMonth)}
              </span>
            </div>
          </div>
        </div>
      )}

      <ChartModal
        open={expandedChart === 'monthly'}
        title="Monthly Spending"
        subtitle={`All ${monthlyData.length} recorded months. Hover a month for exact amounts.`}
        onClose={() => setExpandedChart(null)}
      >
        <ChartSlot height={360}>
          <MonthlyTrendChart
            data={monthlyData}
            height={360}
            privacyMode={privacyMode}
            formatAmount={formatAmount}
          />
        </ChartSlot>
      </ChartModal>

      <ChartModal
        open={expandedChart === 'income'}
        title="Income vs Expenses"
        subtitle={`All ${monthlyData.length} recorded months.`}
        onClose={() => setExpandedChart(null)}
      >
        <ChartSlot height={360}>
          <IncomeExpenseBars
            data={monthlyData}
            height={360}
            maxBarSize={64}
            privacyMode={privacyMode}
            formatAmount={formatAmount}
          />
        </ChartSlot>
      </ChartModal>

      <ChartModal
        open={expandedChart === 'category'}
        title="Spending by Category"
        subtitle={`${categoryData.length} categories, with exact amounts and share of spending.`}
        onClose={() => setExpandedChart(null)}
      >
        <ChartSlot height={280}>
          <CategoryDonut data={pieData} height={280} detailed formatAmount={formatAmount} />
        </ChartSlot>
      </ChartModal>
    </div>
  );
}
