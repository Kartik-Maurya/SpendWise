import React from 'react';
import PrivacyAmount from './PrivacyAmount.jsx';

const WARNING_STATE = {
  exceeded: { label: 'Over budget', severity: 'high' },
  approaching: { label: 'Near limit', severity: 'medium' },
};

export default function BudgetWarningCard({ warning }) {
  const state = WARNING_STATE[warning.status] || WARNING_STATE.approaching;

  return (
    <div className={`warning-card warning-${warning.status}`}>
      <div className="warning-card-head">
        <strong className="warning-category">{warning.category}</strong>
        <span className={`severity-chip severity-${state.severity}`}>{state.label}</span>
      </div>
      <p className="warning-message">{warning.message}</p>
      <span className="warning-detail">
        <PrivacyAmount amount={warning.spent} /> of <PrivacyAmount amount={warning.budget_amount} />{' '}
        used ({warning.percentage}%)
      </span>
    </div>
  );
}
