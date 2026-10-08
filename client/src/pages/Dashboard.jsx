import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import StatCard from '../components/StatCard.jsx';
import BudgetCard from '../components/BudgetCard.jsx';
import PrivacyAmount from '../components/PrivacyAmount.jsx';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
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
} from '../services/api.js';

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export default function Dashboard({ onNavigate }) {
  const { formatAmount } = usePrivacyFormat();
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading && !summary) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const pieData = categoryData.length > 0
    ? categoryData.map((d) => ({ name: d.category, value: d.amount }))
    : [{ name: 'No data', value: 1 }];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <button className="btn btn-secondary" onClick={() => onNavigate('analytics')}>
          View Analytics
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        <StatCard label="Balance" value={summary.balance} type="balance" icon="💰" />
        <StatCard label="Income" value={summary.income} type="income" icon="📈" />
        <StatCard label="Expenses" value={summary.expense} type="expense" icon="📉" />
        <StatCard label="Transactions" value={summary.transactionCount} type="transactions" icon="📋" isCurrency={false} />
      </div>

      <div className="dashboard-charts">
        <div className="chart-container">
          <h3>Monthly Spending</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                 <Tooltip formatter={(value) => formatAmount(value)} />
                <Area type="monotone" dataKey="expenses" stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} />
                <Area type="monotone" dataKey="income" stroke="#16a34a" fill="#16a34a" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No monthly data yet</div>
          )}
        </div>

        <div className="chart-container">
          <h3>Income vs Expenses</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                 <Tooltip formatter={(value) => formatAmount(value)} />
                <Legend />
                <Bar dataKey="income" fill="#16a34a" name="Income" />
                <Bar dataKey="expenses" fill="#dc2626" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No data yet</div>
          )}
        </div>
      </div>

    <div className="dashboard-section">
        <h3>Spending by Category</h3>
        <div className="chart-container">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart margin={{ top: 10, right: 10, bottom: 36, left: 10 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="38%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${Math.round(percent * 100)}%)`}
                  labelPosition="inside"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                 <Tooltip formatter={(value) => formatAmount(value)} />
                <Legend layout="horizontal" verticalAlign="bottom" height={36} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No expense data</div>
          )}
        </div>
      </div>

      {budgets.length > 0 && (
        <div className="dashboard-section">
          <div className="section-header">
            <h3>Budget Overview</h3>
            <button className="btn btn-secondary btn-small" onClick={() => onNavigate('budgets')}>
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
              <div key={w.budget_id} className={`warning-card warning-${w.status}`}>
                <strong>{w.category}</strong>: {w.message}
                  <span className="warning-detail">
                   <PrivacyAmount amount={w.spent} /> of <PrivacyAmount amount={w.budget_amount} /> used ({w.percentage}%)
                 </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Recent Transactions</h3>
          <button className="btn btn-secondary btn-small" onClick={() => onNavigate('transactions')}>
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
                      <div className="transaction-description">{transaction.description}</div>
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
    </div>
  );
}
