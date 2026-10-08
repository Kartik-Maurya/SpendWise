import React from 'react';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';

export default function BudgetCard({ budget, onEdit, onDelete, showActions = true, isCompact = false }) {
  const { formatValue } = usePrivacyFormat();
  const percentage = Math.min(budget.percentage || 0, 100);
  const progressColor =
    budget.percentage >= 100
      ? 'var(--danger)'
      : budget.percentage >= 80
      ? 'var(--warning)'
      : 'var(--success)';

  return (
    <div className={`budget-card status-${budget.status || 'normal'}`}>
      <div className="budget-card-header">
        <span className="budget-category">{budget.category}</span>
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
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${percentage}%`, backgroundColor: progressColor }}
            />
          </div>
          <span className="budget-percentage">{budget.percentage}%</span>
        </div>
        {budget.message && !isCompact && <div className="budget-message">{budget.message}</div>}
      </div>
    </div>
  );
}
