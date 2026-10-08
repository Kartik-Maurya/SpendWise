import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import StatCard from '../components/StatCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
import {
  getSpendingByCategory,
  getMonthlySpending,
  getIncomeVsExpenses,
  getAnalyticsSummary,
} from '../services/api.js';
import { showNotification } from '../components/Notification.jsx';

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Analytics() {
  const { formatAmount } = usePrivacyFormat();
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [iveData, setIveData] = useState({ income: 0, expense: 0 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        getSpendingByCategory(),
        getMonthlySpending(),
        getIncomeVsExpenses(),
        getAnalyticsSummary(),
      ]);

      setCategoryData(results[0].status === 'fulfilled' ? results[0].value : []);
      setMonthlyData(results[1].status === 'fulfilled' ? results[1].value : []);
      setIveData(results[2].status === 'fulfilled' ? results[2].value : { income: 0, expense: 0 });
      setSummary(results[3].status === 'fulfilled' ? results[3].value : null);
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
      showNotification('error', 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const pieData = categoryData.map((d) => ({ name: d.category, value: d.amount }));

  return (
    <div className="analytics-page">
      <h2>Analytics</h2>

      <div className="stats-grid">
        <StatCard label="Total Income" value={iveData.income} type="income" icon="📈" />
        <StatCard label="Total Expenses" value={iveData.expense} type="expense" icon="📉" />
        <StatCard
          label="Net Savings"
          value={iveData.income - iveData.expense}
          type={iveData.income - iveData.expense >= 0 ? 'income' : 'expense'}
          icon="💰"
        />
      </div>

      {summary && (
        <div className="dashboard-section">
          <h3>Monthly Summary</h3>
          <div className="analytics-summary-grid">
            <div className="summary-item">
              <span className="summary-label">Highest Spending Category</span>
              <span className="summary-value">{summary.highestSpendingCategory || 'N/A'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Spending This Month</span>
               <span className="summary-value">{formatAmount(summary.totalSpendingThisMonth)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Income This Month</span>
               <span className="summary-value">{formatAmount(summary.totalIncomeThisMonth)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Net Savings This Month</span>
              <span className={`summary-value ${summary.netSavingsThisMonth >= 0 ? 'positive' : 'negative'}`}>
                 {formatAmount(summary.netSavingsThisMonth)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-charts">
        <ChartCard title="Spending by Category">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 10, right: 10, bottom: 36, left: 10 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="40%"
                  innerRadius={65}
                  outerRadius={95}
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
            <div className="chart-empty">No expense data available</div>
          )}
        </ChartCard>

        <ChartCard title="Monthly Income vs Expenses">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
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
            <div className="chart-empty">No data available</div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Spending Trend Over Time">
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatAmount(value)} />
              <Area type="monotone" dataKey="income" stroke="#16a34a" fill="#16a34a" fillOpacity={0.1} />
              <Area type="monotone" dataKey="expenses" stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-empty">No data available</div>
        )}
      </ChartCard>
    </div>
  );
}
