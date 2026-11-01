import React from 'react';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';

function budgetState(budget) {
  if (budget.status === 'exceeded') {
    return {
      key: 'exceeded',
      label: budget.remaining < 0 ? 'Over budget' : 'At limit',
    };
  }
  if (budget.status === 'approaching') return { key: 'approaching', label: 'Near limit' };
  return { key: 'normal', label: 'On track' };
}

export default function BudgetCard({ budget, onEdit, onDelete, showActions = true, isCompact = false }) {
  const { formatValue } = usePrivacyFormat();
  const state = budgetState(budget);
  const percentage = Math.min(budget.percentage || 0, 100);

  return (
    <div className={`budget-card status-${state.key}`}>
      <div className="budget-card-header">
        <div className="budget-card-title">
          <span className="budget-category">{budget.category}</span>
          <span className={`budget-status status-${state.key}`}>{state.label}</span>
        </div>
        {!isCompact && showActions && onEdit && (
          <div className="budget-actions">
            <button className="btn btn-small btn-edit" onClick={() => onEdit(budget)}>
              Edit
            </button>
            {onDelete && (
              <button className="btn btn-small btn-delete" onClick={() => onDelete(budget)}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      <div className="budget-card-body">
        {!isCompact && (
          <div className="budget-amounts">
            <span className="budget-spent">
              {formatValue(budget.spent)} / {formatValue(budget.amount)}
            </span>
            <span className="budget-remaining">
              {budget.remaining !== undefined && `Remaining: ${formatValue(budget.remaining)}`}
            </span>
          </div>
        )}
        <div className="progress-bar-wrapper">
          <div
            className="progress-bar"
            role="progressbar"
            aria-label={`${budget.category} budget used`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <div className="progress-fill" style={{ width: `${percentage}%` }} />
          </div>
          <span className="budget-percentage">{budget.percentage}%</span>
        </div>
        {budget.message && !isCompact && <div className="budget-message">{budget.message}</div>}
      </div>
    </div>
  );
}
