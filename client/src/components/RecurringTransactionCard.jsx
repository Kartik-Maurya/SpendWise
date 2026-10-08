import React from 'react';
import { formatDate } from '../utils/format.js';
import PrivacyAmount from './PrivacyAmount.jsx';

export default function RecurringTransactionCard({ transaction, onEdit, onDelete, onToggle }) {
  const typeClass = transaction.type;

  return (
    <div className={`transaction-card ${transaction.is_active ? 'active' : 'inactive'}`}>
      <div className="transaction-header">
        <span className={`transaction-type ${typeClass}`}>
          {transaction.type === 'income' ? '↑ Income' : '↓ Expense'}
        </span>
        <span className="recurring-frequency">{transaction.frequency}</span>
      </div>
      <div className="transaction-body">
        <div className="transaction-details">
          <div className="transaction-category">{transaction.category}</div>
          <div className="transaction-description">{transaction.description}</div>
          <div className="transaction-meta">
            <span className="transaction-amount"><PrivacyAmount amount={transaction.amount} prefix={transaction.type === 'income' ? '+' : '-'} /> / {transaction.frequency}</span>
            <span className="transaction-date">Next: {formatDate(transaction.next_occurrence)}</span>
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
