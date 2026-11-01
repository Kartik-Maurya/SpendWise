import React, { lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InsightFeed from '../components/analytics/InsightFeed.jsx';
import PlanPanel from '../components/analytics/PlanPanel.jsx';
import ReadinessPanel from '../components/analytics/ReadinessPanel.jsx';
import RecommendationPanel from '../components/analytics/RecommendationPanel.jsx';
import PacingPanel from '../components/analytics/PacingPanel.jsx';
import CategoryBreakdown from '../components/analytics/CategoryBreakdown.jsx';
import BacktestPanel from '../components/analytics/BacktestPanel.jsx';
import ProofDrawer from '../components/analytics/ProofDrawer.jsx';
import InfoHint from '../components/InfoHint.jsx';
import ChartModal from '../components/ChartModal.jsx';
import ChartDataTable from '../components/ChartDataTable.jsx';
import ChartSlot from '../components/charts/ChartSlot.jsx';
import { showNotification } from '../components/Notification.jsx';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';

const IncomeExpenseBars = lazy(() => import('../components/charts/IncomeExpenseBars.jsx'));
import {
  getAnalyticsOverview,
  getAnalyticsPlan,
  getRecommendations,
  getAnalyticsBacktest,
  getSpendingByCategory,
  getMonthlySpending,
  getTransactionById,
  applyRecommendations,
  updateAnalyticsPlan,
  getReportUrl,
} from '../services/api.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_LABEL = {
  exceeded: 'over budget',
  at_risk: 'at risk',
  underspending: 'underspending',
  on_track: 'on track',
  unbudgeted: 'unbudgeted',
};

export default function Analytics({ onAddTransaction, refreshToken }) {
  const navigate = useNavigate();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { formatAmount, formatDescription, privacyMode } = usePrivacyFormat();
  const [period, setPeriod] = useState({ month: currentMonth, year: currentYear });
  const [overview, setOverview] = useState(null);
  const [plan, setPlan] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [objectiveBusy, setObjectiveBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyWarnings, setApplyWarnings] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [trendExpanded, setTrendExpanded] = useState(false);
  const [trendTableView, setTrendTableView] = useState(false);
  const requestRef = useRef(0);

  const loadAll = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError('');
    setApplyWarnings([]);

    const params = { month: period.month, year: period.year };
    const results = await Promise.allSettled([
      getAnalyticsOverview(params),
      getAnalyticsPlan(params),
      getRecommendations(params),
      getAnalyticsBacktest({ ...params, months: 6 }),
      getSpendingByCategory(params),
      getMonthlySpending(),
    ]);

    if (requestId !== requestRef.current) return;

    const [overviewResult, planResult, recommendationResult, backtestResult, categoryResult, monthlyResult] =
      results;

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      setOverview(null);
      setError(overviewResult.reason?.message || 'Failed to load the analysis');
    }
    setPlan(planResult.status === 'fulfilled' ? planResult.value : null);
    setRecommendation(recommendationResult.status === 'fulfilled' ? recommendationResult.value : null);
    setBacktest(backtestResult.status === 'fulfilled' ? backtestResult.value : null);
    setCategoryData(
      categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value)
        ? categoryResult.value
        : []
    );
    setMonthlyData(
      monthlyResult.status === 'fulfilled' && Array.isArray(monthlyResult.value)
        ? monthlyResult.value
        : []
    );
    setLoading(false);
  }, [period.month, period.year, refreshToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setDrawer(null);
    setTrendExpanded(false);
  }, [period.month, period.year]);

  const isCurrent =
    period.month === currentMonth && period.year === currentYear;
  const isClosed = Boolean(overview && !overview.period.isCurrent);

  const incomeUsed = overview?.income?.value ?? overview?.totals.income ?? 0;
  const monthlyActivity = monthlyData.filter(
    (row) => Number(row.income) > 0 || Number(row.expenses) > 0
  );
  const trendColumns = [
    { key: 'month', label: 'Month' },
    { key: 'income', label: 'Income', align: 'right', render: (row) => formatAmount(row.income) },
    { key: 'expenses', label: 'Expenses', align: 'right', render: (row) => formatAmount(row.expenses) },
  ];

  const updatePeriod = (month, year) => {
    const target = new Date(year, month - 1, 1);
    const cap = new Date(currentYear, currentMonth - 1, 1);
    if (target > cap) return;
    setPeriod({ month, year });
  };

  const shiftPeriod = (delta) => {
    const target = new Date(period.year, period.month - 1 + delta, 1);
    updatePeriod(target.getMonth() + 1, target.getFullYear());
  };

  const focusPlan = () => {
    document.getElementById('plan-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToRebalance = () => {
    document.getElementById('rebalance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSavePlan = async (values) => {
    setSavingPlan(true);
    try {
      await updateAnalyticsPlan({
        month: period.month,
        year: period.year,
        income_assumption: values.income_assumption,
        savings_target: values.savings_target,
        objective: values.objective,
      });
      showNotification('success', 'Monthly plan saved');
      await loadAll();
    } catch (err) {
      showNotification('error', err.message || 'Failed to save the plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleObjectiveChange = async (nextObjective) => {
    if (!plan || plan.objective === nextObjective) return;
    setObjectiveBusy(true);
    try {
      await updateAnalyticsPlan({
        month: period.month,
        year: period.year,
        income_assumption: plan.income_assumption,
        savings_target: plan.savings_target ?? 0,
        objective: nextObjective,
      });
      showNotification(
        'success',
        nextObjective === 'savings'
          ? 'Objective set to save more'
          : 'Objective set to avoid overruns'
      );
      await loadAll();
    } catch (err) {
      showNotification('error', err.message || 'Failed to change the objective');
    } finally {
      setObjectiveBusy(false);
    }
  };

  const handleApply = async (entries) => {
    setApplying(true);
    try {
      const result = await applyRecommendations({
        month: period.month,
        year: period.year,
        objective: recommendation?.objective,
        categories: entries,
      });
      await loadAll();
      setApplyWarnings(result.warnings || []);
      const changed = result.applied.length + result.deleted.length;
      showNotification('success', `Applied ${changed} budget change${changed === 1 ? '' : 's'}`);
    } catch (err) {
      showNotification('error', err.message || 'Failed to apply the recommendation');
    } finally {
      setApplying(false);
    }
  };

  const openSafeProof = () => {
    if (!overview) return;
    const safe = overview.safeToSpend || {};
    setDrawer({
      title: 'Safe to spend',
      subtitle: 'A daily allowance after the spending already committed this month.',
      proof: safe,
      rows: [
        { label: 'Available for the rest of the month', value: formatAmount(safe.available || 0) },
        { label: 'Committed charges remaining', value: formatAmount(safe.committedRemaining || 0) },
        { label: 'Days remaining', value: safe.daysRemaining },
        {
          label: 'Envelope source',
          value: safe.usingBudgets ? 'Category budgets' : 'Income estimate minus savings target',
        },
      ],
    });
  };

  const openIncomeProof = () => {
    if (!overview || !overview.income) return;
    setDrawer({
      title: 'Income used in this analysis',
      subtitle: 'An explicit assumption in the plan takes priority over recorded income.',
      proof: overview.income,
    });
  };

  const openReadinessWhy = () => {
    if (!overview) return;
    const coverage = overview.coverage;
    const available = coverage.readiness.filter((item) => item.status === 'available');
    const locked = coverage.readiness.filter((item) => item.status === 'locked');
    setDrawer({
      title: 'Why the analysis depth is limited',
      subtitle: coverage.tier.detail,
      rows: [
        { label: 'Tier', value: `${coverage.tier.level} - ${coverage.tier.label}` },
        { label: 'Completed months with expenses', value: coverage.expenseMonths },
        { label: 'Transactions observed', value: coverage.totalTransactions },
        { label: 'Unlocked now', value: available.map((item) => item.label).join(', ') || 'None' },
        {
          label: 'Still missing',
          value:
            locked.map((item) => `${item.label}: ${item.missing.join('; ')}`).join(' | ') ||
            'Nothing',
        },
        {
          label: 'Next tier',
          value: coverage.nextTier
            ? `${coverage.nextTier.label} needs ${coverage.nextTier.monthsNeeded} more month(s) with expenses`
            : 'Top tier reached',
        },
      ],
      raw: coverage.readiness,
      rawLabel: 'Readiness requirements',
    });
  };

  const openInsightWhy = (insight) => {
    setDrawer({
      title: insight.title,
      subtitle: insight.detail,
      rows: [
        { label: 'Severity', value: insight.severity },
        { label: 'Amount at stake', value: insight.amount > 0 ? formatAmount(insight.amount) : 'n/a' },
        { label: 'Category', value: insight.category || 'n/a' },
        { label: 'Confidence', value: insight.confidence || 'n/a' },
        { label: 'Suggested action', value: insight.action?.label || 'n/a' },
      ],
      raw: insight.evidence,
      rawLabel: 'Insight evidence',
    });
  };

  const handleInsightAction = async (insight) => {
    const action = insight.action || {};
    switch (action.kind) {
      case 'add_transactions':
        onAddTransaction?.();
        return;
      case 'review_recurring':
        navigate('/transactions?tab=recurring');
        return;
      case 'review_budget':
        navigate('/budgets');
        return;
      case 'open_recommendations':
        scrollToRebalance();
        return;
      case 'edit_plan':
        focusPlan();
        return;
      case 'review_transaction':
        if (action.transactionId) {
          try {
            const transaction = await getTransactionById(action.transactionId);
            setDrawer({
              title: `${transaction.category} transaction`,
              subtitle: `Recorded on ${transaction.date}`,
              rows: [
                { label: 'Amount', value: formatAmount(transaction.amount) },
                { label: 'Type', value: transaction.type },
                { label: 'Category', value: transaction.category },
                { label: 'Description', value: formatDescription(transaction.description) || 'No description' },
              ],
              raw: transaction,
              rawLabel: 'Transaction record',
            });
            return;
          } catch (err) {
            showNotification('error', err.message || 'Could not open the transaction');
          }
        }
        openInsightWhy(insight);
        return;
      default:
        openInsightWhy(insight);
    }
  };

  const openPacingWhy = (row) => {
    setDrawer({
      title: `${row.category} pacing`,
      subtitle: 'Projection method and the evidence behind it.',
      rows: [
        { label: 'Budget', value: row.budget === null ? 'No budget' : formatAmount(row.budget) },
        { label: 'Spent so far', value: formatAmount(row.spent) },
        { label: 'Projected month end', value: formatAmount(row.projected) },
        {
          label: 'Variance to budget',
          value: row.variance === null ? 'n/a' : formatAmount(row.variance),
        },
        { label: 'Status', value: STATUS_LABEL[row.status] || row.status },
        { label: 'Confidence', value: row.confidence },
        { label: 'Method', value: row.method },
        { label: 'Prior months with spend', value: row.historyMonths },
      ],
      raw: row,
      rawLabel: 'Pacing row',
    });
  };

  const openCategoryWhy = (item) => {
    setDrawer({
      title: `${item.category} budget target`,
      subtitle: item.essential
        ? 'Essential category: the floor protects your usual spend and committed charges.'
        : 'Flexible category: the target leans below the median to free money.',
      rows: [
        {
          label: 'Current budget',
          value: item.currentBudget === null ? 'None' : formatAmount(item.currentBudget),
        },
        { label: 'Recommended target', value: formatAmount(item.target) },
        { label: 'Protected floor', value: formatAmount(item.floor) },
        { label: 'Cap', value: formatAmount(item.cap) },
        { label: 'Three-month median', value: formatAmount(item.median) },
        { label: 'Variation', value: `${Math.round(item.cv * 100)}%` },
        { label: 'History', value: `${item.historyMonths} month(s) with spend` },
        {
          label: 'Forecast',
          value: `${formatAmount(item.forecast.point)} (${formatAmount(item.forecast.low)} - ${formatAmount(item.forecast.high)})`,
        },
        { label: 'Floor basis', value: item.evidence.floorBasis },
        { label: 'Cap basis', value: item.evidence.capBasis },
        { label: 'Essential because', value: item.essentialSource },
        {
          label: 'Monthly series',
          value: item.evidence.monthlySeries.map((value) => formatAmount(value)).join(' -> '),
        },
        { label: 'Reason', value: item.reason },
      ],
      raw: item.evidence,
      rawLabel: 'Category evidence',
    });
  };

  const openRecommendationWhy = () => {
    if (!recommendation) return;
    setDrawer({
      title: 'How the rebalance is built',
      subtitle:
        recommendation.objective === 'savings'
          ? 'Lean discretionary targets, protected essentials, and a cap on every category.'
          : 'Forecast-led targets, with spare envelope allocated to essentials first.',
      proof: recommendation.income,
      rows: [
        { label: 'Objective', value: recommendation.objective },
        { label: 'Savings target', value: formatAmount(recommendation.savingsTarget) },
        { label: 'Envelope', value: formatAmount(recommendation.envelope) },
        {
          label: 'Committed recurring',
          value: formatAmount(recommendation.committed.totalMonthly),
        },
        {
          label: 'Feasible',
          value: recommendation.feasible
            ? 'Yes'
            : `No - floors exceed the envelope by ${formatAmount(recommendation.deficit)}`,
        },
        { label: 'Current budgets total', value: formatAmount(recommendation.totalCurrent) },
        { label: 'Proposed total', value: formatAmount(recommendation.totalProposed) },
        {
          label: 'Held within 20% of current',
          value: recommendation.limitedByStability.join(', ') || 'None',
        },
        { label: 'Notes', value: recommendation.notes.join(' | ') || 'None' },
      ],
      raw: {
        objective: recommendation.objective,
        savingsTarget: recommendation.savingsTarget,
        envelope: recommendation.envelope,
        committed: recommendation.committed,
        feasible: recommendation.feasible,
        deficit: recommendation.deficit,
        notes: recommendation.notes,
        limitedByStability: recommendation.limitedByStability,
      },
      rawLabel: 'Rebalance inputs',
    });
  };

  const openBacktestWhy = () => {
    if (!backtest) return;
    const forecast = backtest.forecast || {};
    setDrawer({
      title: 'How the backtest works',
      subtitle: 'Each month is replayed using only the data available before it.',
      rows: [
        { label: 'Forecast method', value: forecast.method || 'n/a' },
        { label: 'Forecast assumption', value: forecast.assumption || 'n/a' },
        { label: 'Folds evaluated', value: forecast.folds ?? 0 },
        { label: 'Mean absolute error', value: forecast.mae === null ? 'n/a' : formatAmount(forecast.mae) },
        {
          label: 'Repeat-last-month error',
          value: forecast.naiveMae === null ? 'n/a' : formatAmount(forecast.naiveMae),
        },
        {
          label: 'Months evaluated',
          value: Array.isArray(forecast.monthsEvaluated)
            ? forecast.monthsEvaluated.join(', ')
            : 'n/a',
        },
        {
          label: 'Counterfactual verdict',
          value: backtest.recommendations?.verdict || 'n/a',
        },
      ],
      raw: backtest,
      rawLabel: 'Backtest output',
    });
  };

  const yearOptions = [];
  for (let year = currentYear; year >= currentYear - 5; year -= 1) yearOptions.push(year);
  if (!yearOptions.includes(period.year)) {
    yearOptions.push(period.year);
    yearOptions.sort((a, b) => b - a);
  }

  const header = (
    <div className="page-header analytics-header">
      <div>
        <h2>Analytics</h2>
        <p className="page-subtitle">What happened, why it happened, and what to do next.</p>
      </div>
      <div className="period-controls" aria-label="Analysis period">
        <button
          type="button"
          className="period-arrow"
          onClick={() => shiftPeriod(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <select
          name="analytics-month"
          value={period.month}
          onChange={(event) => updatePeriod(Number(event.target.value), period.year)}
          aria-label="Month"
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          name="analytics-year"
          value={period.year}
          onChange={(event) => updatePeriod(period.month, Number(event.target.value))}
          aria-label="Year"
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="period-arrow"
          onClick={() => shiftPeriod(1)}
          disabled={isCurrent}
          aria-label="Next month"
        >
          ›
        </button>
        {!isCurrent && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setPeriod({ month: currentMonth, year: currentYear })}
          >
            Current month
          </button>
        )}
        <a
          className="btn btn-secondary btn-small"
          href={getReportUrl(period.month, period.year, privacyMode)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open a printable monthly report in a new tab"
        >
          Monthly report
        </a>
      </div>
    </div>
  );

  if (!overview) {
    return (
      <div className="analytics-page">
        {header}
        {error && <div className="error-message">{error}</div>}
        {loading ? (
          <div className="loading">Loading analysis...</div>
        ) : (
          <div className="empty-state">
            <p>No analysis is available for this month yet.</p>
            <button type="button" className="btn btn-primary" onClick={loadAll}>
              Try again
            </button>
          </div>
        )}
        <ProofDrawer drawer={drawer} onClose={() => setDrawer(null)} />
      </div>
    );
  }

  const safe = overview.safeToSpend || {};
  const savings = safe.savings;
  const savingsStatus = savings
    ? savings.onTrack === true
      ? 'On track'
      : savings.onTrack === false
        ? 'Short'
        : 'Unknown'
    : 'Unknown';

  return (
    <div className="analytics-page">
      {header}
      {error && <div className="error-message">{error}</div>}

      <section className="safe-hero">
        <div className="safe-hero-main">
          <div className="hero-eyebrow">
            <span className="eyebrow">{isClosed ? 'Completed month' : 'Safe to spend per day'}</span>
            {!isClosed && (
              <InfoHint label="How safe to spend is calculated">
                Income used minus the savings target, minus spending already recorded and charges
                still committed, divided by the days left in the month.
              </InfoHint>
            )}
          </div>
          {isClosed ? (
            <>
              <div className="safe-value">
                {formatAmount(overview.totals.net)}
                <span> net</span>
              </div>
              <p className="safe-copy">
                This month is closed. Safe-to-spend applies to the current month; here you can
                review pace, anomalies and what the rebalancer would have recommended.
              </p>
              <div className="hero-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={openIncomeProof}>
                  Income used
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="safe-value">
                {formatAmount(safe.value || 0)}
                <span>/day</span>
              </div>
              <p className="safe-copy">
                {safe.available > 0
                  ? `${formatAmount(safe.available)} remains for ${safe.daysRemaining} day(s) after committed charges.`
                  : 'No spendable amount remains this month after budgets, spending and committed charges.'}
              </p>
              <div className="hero-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={openSafeProof}>
                  Why this number
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={openIncomeProof}>
                  Income used
                </button>
              </div>
            </>
          )}
        </div>

        <div className="safe-hero-side">
          <div className="hero-metric">
            <span>{isClosed ? 'Net' : 'Available now'}</span>
            <strong>{formatAmount(isClosed ? overview.totals.net : safe.available || 0)}</strong>
          </div>
          <div className="hero-metric">
            <span>Committed remaining</span>
            <strong>{formatAmount(safe.committedRemaining || 0)}</strong>
          </div>
          <div className="hero-metric">
            <span>
              Income used
              <InfoHint label="About the income used">
                {overview.income?.method || 'Recorded income'}.
                {overview.income?.assumptions?.length > 0 && (
                  <> {overview.income.assumptions.join(' ')}</>
                )}
              </InfoHint>
            </span>
            <strong>{formatAmount(incomeUsed)}</strong>
          </div>
          <div className="hero-metric">
            <span>Expenses</span>
            <strong>{formatAmount(overview.totals.expense)}</strong>
          </div>
        </div>

        <div className="savings-strip">
          {savings ? (
            <>
              <div>
                <span>Savings target</span>
                <strong>{formatAmount(savings.target)}</strong>
              </div>
              <div>
                <span>Projected savings</span>
                <strong>{savings.projected === null ? 'n/a' : formatAmount(savings.projected)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong
                  className={
                    savings.onTrack === true
                      ? 'positive'
                      : savings.onTrack === false
                        ? 'negative'
                        : ''
                  }
                >
                  {savingsStatus}
                </strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>Actual savings</span>
                <strong className={overview.totals.net >= 0 ? 'positive' : 'negative'}>
                  {formatAmount(overview.totals.net)}
                </strong>
              </div>
              <div>
                <span>Days in month</span>
                <strong>{new Date(period.year, period.month, 0).getDate()}</strong>
              </div>
              <div>
                <span>Transactions</span>
                <strong>{overview.totals.transactionCount}</strong>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="analytics-main-grid">
        <InsightFeed
          insights={overview.insights}
          onAction={handleInsightAction}
          onWhy={openInsightWhy}
        />
        <PlanPanel plan={plan} onSave={handleSavePlan} saving={savingPlan} />
      </div>

      <ReadinessPanel coverage={overview.coverage} onWhy={openReadinessWhy} />

      <RecommendationPanel
        recommendation={recommendation}
        canApply={overview.period.isCurrent}
        onObjectiveChange={handleObjectiveChange}
        onApply={handleApply}
        onWhyCategory={openCategoryWhy}
        onWhy={openRecommendationWhy}
        onEditPlan={focusPlan}
        applying={applying}
        objectiveBusy={objectiveBusy}
        applyWarnings={applyWarnings}
      />

      <div className="analytics-bottom-grid">
        <PacingPanel pacing={overview.pacing} onWhy={openPacingWhy} />
        <CategoryBreakdown data={categoryData} />
      </div>

      <BacktestPanel backtest={backtest} onWhy={openBacktestWhy} />

      <section className="analysis-panel trend-panel">
        <header className="panel-head">
          <h3>
            Income and spending over time
            <InfoHint label="About the trend chart">
              Every month with recorded activity, for context. The selected month drives the
              analysis above.
            </InfoHint>
          </h3>
          {monthlyActivity.length > 0 && (
            <div className="chart-actions">
              <button
                type="button"
                className="chart-expand"
                onClick={() => setTrendTableView((value) => !value)}
                aria-expanded={trendTableView}
                aria-controls="trend-chart-data"
              >
                {trendTableView ? 'Show chart' : 'Data table'}
              </button>
              <button
                type="button"
                className="chart-expand"
                onClick={() => setTrendExpanded(true)}
              >
                Expand
              </button>
            </div>
          )}
        </header>
        {monthlyActivity.length === 0 ? (
          <div className="panel-empty">No months with income or expenses to chart yet.</div>
        ) : (
          <>
            <div className="analytics-chart" hidden={trendTableView}>
              <ChartSlot height={210}>
                <IncomeExpenseBars
                  data={monthlyActivity.slice(-12)}
                  height={210}
                  maxBarSize={56}
                  privacyMode={privacyMode}
                  formatAmount={formatAmount}
                />
              </ChartSlot>
            </div>
            <ChartDataTable
              id="trend-chart-data"
              caption="Monthly income and expenses, last twelve months with activity"
              columns={trendColumns}
              rows={monthlyActivity.slice(-12)}
              hidden={!trendTableView}
            />
          </>
        )}
      </section>

      <ChartModal
        open={trendExpanded}
        title="Income and spending over time"
        subtitle={`All ${monthlyActivity.length} recorded months. Hover a month for exact amounts.`}
        onClose={() => setTrendExpanded(false)}
      >
        <ChartSlot height={360}>
          <IncomeExpenseBars
            data={monthlyActivity}
            height={360}
            maxBarSize={64}
            privacyMode={privacyMode}
            formatAmount={formatAmount}
          />
        </ChartSlot>
      </ChartModal>

      <ProofDrawer drawer={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
