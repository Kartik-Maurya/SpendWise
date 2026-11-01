import React from 'react';
import { formatDate, formatDateTime } from '../utils/format.js';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
import PrivacyAmount from './PrivacyAmount.jsx';

export default function RecurringTransactionCard({
  transaction,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onToggle,
}) {
  const { formatDescription } = usePrivacyFormat();
  const typeClass = transaction.type;

  return (
    <div
      className={`transaction-card ${transaction.is_active ? 'active' : 'inactive'} ${
        selected ? 'selected' : ''
      }`}
    >
      <div className="transaction-header">
        <div className="transaction-header-main">
          <label className="transaction-select">
            <input
              type="checkbox"
              checked={Boolean(selected)}
              onChange={() => onSelect(transaction.id)}
              aria-label={`Select ${transaction.category} recurring transaction`}
            />
          </label>
          <span className={`transaction-type ${typeClass}`}>
            {transaction.type === 'income' ? '↑ Income' : '↓ Expense'}
          </span>
          <span className="recurring-frequency">{transaction.frequency}</span>
        </div>
        <span className={`transaction-amount ${typeClass}`}>
          <PrivacyAmount
            amount={transaction.amount}
            prefix={transaction.type === 'income' ? '+' : '-'}
          />
        </span>
      </div>
      <div className="transaction-body">
        <div className="transaction-details">
          <div className="transaction-category">{transaction.category}</div>
          <div className="transaction-description">
            {formatDescription(transaction.description)}
          </div>
          <div className="transaction-meta">
            <span className="transaction-date">📅 Next: {formatDate(transaction.next_occurrence)}</span>
            <span className="transaction-created">🕒 {formatDateTime(transaction.created_at)}</span>
          </div>
        </div>
        <div className="transaction-actions">
          <button className="btn btn-small" onClick={() => onToggle(transaction)}>
            {transaction.is_active ? 'Pause' : 'Activate'}
          </button>
          <button className="btn btn-small btn-edit" onClick={() => onEdit(transaction)}>
            Edit
          </button>
          <button className="btn btn-small btn-delete" onClick={() => onDelete(transaction)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
