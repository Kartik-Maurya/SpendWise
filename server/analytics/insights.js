const { round2 } = require('./stats');

const SEVERITY_RANK = { high: 3, medium: 2, low: 1, info: 0 };

function makeInsight({
  type,
  severity,
  title,
  detail,
  amount = 0,
  category = null,
  confidence = null,
  action,
  evidence = {},
}) {
  return {
    type,
    severity,
    title,
    detail,
    amount: round2(amount),
    category,
    confidence,
    action,
    evidence,
  };
}

function buildInsights({
  pacing,
  anomalies,
  recurrence,
  safeToSpend,
  coverage,
  recommendation,
  period,
}) {
  const insights = [];
  let sequence = 0;
  const push = (insight) => {
    sequence += 1;
    insights.push({ id: `${insight.type}:${sequence}`, ...insight });
  };

  if (pacing && pacing.totals.budgetTotal === 0) {
    push(
      makeInsight({
        type: 'no_budgets',
        severity: 'medium',
        title: 'No budgets set for this month',
        detail:
          'Without budgets the app can still show spending, but it cannot tell you what is safe to spend or which category needs redirecting.',
        amount: 0,
        action: { kind: 'open_recommendations', label: 'Build budgets from history' },
        evidence: { spentSoFar: pacing.totals.spentTotal },
      })
    );
  }

  for (const row of pacing ? pacing.rows : []) {
    if (row.status === 'exceeded') {
      push(
        makeInsight({
          type: 'budget_exceeded',
          severity: 'high',
          title: `${row.category} is over budget`,
          detail: `Spent ₹${row.spent} against a ₹${row.budget} budget (${row.percentUsed}% used).`,
          amount: row.spent - row.budget,
          category: row.category,
          confidence: row.confidence,
          action: { kind: 'review_budget', label: 'Review budget', category: row.category },
          evidence: { spent: row.spent, budget: row.budget, projected: row.projected },
        })
      );
    } else if (row.status === 'at_risk') {
      const severity = row.variance > row.budget * 0.15 ? 'high' : 'medium';
      push(
        makeInsight({
          type: 'budget_at_risk',
          severity,
          title: `${row.category} is projected to overrun`,
          detail: `Projected ₹${row.projected} by month end, ₹${row.variance} above the ₹${row.budget} budget.`,
          amount: row.variance,
          category: row.category,
          confidence: row.confidence,
          action: { kind: 'open_recommendations', label: 'See reallocation options', category: row.category },
          evidence: { spent: row.spent, budget: row.budget, projected: row.projected, method: row.method },
        })
      );
    } else if (row.status === 'underspending') {
      push(
        makeInsight({
          type: 'budget_slack',
          severity: 'low',
          title: `${row.category} has room to redirect`,
          detail: `Projected ₹${row.projected} against a ₹${row.budget} budget, leaving about ₹${round2(row.budget - row.projected)} unused.`,
          amount: row.budget - row.projected,
          category: row.category,
          confidence: row.confidence,
          action: { kind: 'open_recommendations', label: 'Redirect the surplus', category: row.category },
          evidence: { projected: row.projected, budget: row.budget },
        })
      );
    }
  }

  for (const anomaly of anomalies ? anomalies.items : []) {
    push(
      makeInsight({
        type: 'anomaly',
        severity: anomaly.severity,
        title: `Unusual ${anomaly.category} transaction`,
        detail: `₹${anomaly.amount} on ${anomaly.date}, against a typical ₹${anomaly.typical}. Score ${anomaly.score}.`,
        amount: anomaly.amount,
        category: anomaly.category,
        confidence: 'medium',
        action: {
          kind: 'review_transaction',
          label: 'Open transaction',
          transactionId: anomaly.transaction_id,
        },
        evidence: anomaly.evidence,
      })
    );
  }

  const committed = (recurrence && recurrence.committed) || { totalMonthly: 0, items: [] };
  const detected = (recurrence && recurrence.detected) || { totalMonthly: 0, items: [] };
  const committedTotal = committed.totalMonthly + detected.totalMonthly;
  if (committedTotal > 0) {
    const parts = [];
    if (committed.totalMonthly > 0) {
      parts.push(`₹${round2(committed.totalMonthly)} from ${committed.items.length} recurring template(s)`);
    }
    if (detected.totalMonthly > 0) {
      parts.push(`₹${round2(detected.totalMonthly)} from ${detected.items.length} detected repeat charge(s)`);
    }
    push(
      makeInsight({
        type: 'committed_spending',
        severity: 'info',
        title: `₹${round2(committedTotal)} per month is already committed`,
        detail: `${parts.join(' and ')}. Fixed costs come out before any discretionary budget.`,
        amount: committedTotal,
        confidence: 'medium',
        action: { kind: 'review_recurring', label: 'Review recurring charges' },
        evidence: {
          templates: committed.items,
          detected: detected.items.map((item) => ({
            category: item.category,
            amount: item.amount,
            occurrences: item.occurrences,
            monthlyCost: item.monthlyCost,
          })),
        },
      })
    );
  }

  const savings = safeToSpend ? safeToSpend.savings : null;
  if (savings && savings.target > 0) {
    if (savings.onTrack === false) {
      push(
        makeInsight({
          type: 'savings_shortfall',
          severity: 'high',
          title: 'Savings target is projected to be missed',
          detail: `Projected savings ₹${savings.projected} against a target of ₹${savings.target}.`,
          amount: savings.target - savings.projected,
          confidence:
            safeToSpend.confidence && safeToSpend.confidence.level
              ? safeToSpend.confidence.level
              : 'low',
          action: { kind: 'edit_plan', label: 'Adjust the plan' },
          evidence: savings,
        })
      );
    } else if (savings.onTrack === true) {
      push(
        makeInsight({
          type: 'savings_on_track',
          severity: 'info',
          title: 'Savings target is on track',
          detail: `Projected savings ₹${savings.projected} against a target of ₹${savings.target}.`,
          amount: 0,
          action: { kind: 'edit_plan', label: 'View the plan' },
          evidence: savings,
        })
      );
    }
  }

  if (recommendation) {
    if (recommendation.status === 'locked') {
      push(
        makeInsight({
          type: 'recommendation_locked',
          severity: 'info',
          title: 'Budget recommendation is not ready yet',
          detail:
            recommendation.missing && recommendation.missing.length
              ? `${recommendation.reason} Missing: ${recommendation.missing.join('; ')}.`
              : recommendation.reason,
          amount: 0,
          action: { kind: 'add_transactions', label: 'Add transactions' },
          evidence: { missing: recommendation.missing },
        })
      );
    } else if (recommendation.feasible === false) {
      push(
        makeInsight({
          type: 'plan_infeasible',
          severity: 'high',
          title: 'The current plan cannot fit protected essentials',
          detail: `Protected floors exceed the envelope by ₹${recommendation.deficit}. Reduce the savings target or raise the income assumption.`,
          amount: recommendation.deficit,
          action: { kind: 'edit_plan', label: 'Adjust the plan' },
          evidence: { envelope: recommendation.envelope, deficit: recommendation.deficit },
        })
      );
    } else if (recommendation.extraSavings > 0) {
      push(
        makeInsight({
          type: 'redirectable',
          severity: 'medium',
          title: `₹${recommendation.extraSavings} can be redirected`,
          detail:
            'The proposed budgets are leaner than the envelope. That amount can fund savings or a goal instead of being absorbed by spending.',
          amount: recommendation.extraSavings,
          action: { kind: 'open_recommendations', label: 'Review the proposal' },
          evidence: {
            envelope: recommendation.envelope,
            totalProposed: recommendation.totalProposed,
            objective: recommendation.objective,
          },
        })
      );
    }
  }

  if (coverage && coverage.tier.level < 2) {
    push(
      makeInsight({
        type: 'readiness',
        severity: 'info',
        title: 'More history will unlock stronger analysis',
        detail: coverage.tier.detail,
        amount: 0,
        action: { kind: 'add_transactions', label: 'Add transactions' },
        evidence: { tier: coverage.tier },
      })
    );
  }

  insights.sort((a, b) => {
    const bySeverity = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (bySeverity !== 0) return bySeverity;
    return b.amount - a.amount;
  });

  return {
    items: insights.slice(0, 12),
    total: insights.length,
    generatedFor: period.key,
    rankedBy: 'severity, then amount',
  };
}

module.exports = {
  buildInsights,
  SEVERITY_RANK,
};
