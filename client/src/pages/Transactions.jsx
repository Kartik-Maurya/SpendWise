import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTransactions,
  deleteTransaction,
  updateTransaction,
  getRecurringById,
  createRecurring,
  updateRecurring,
  exportCsv,
} from '../services/api.js';
import TransactionForm from '../components/TransactionForm.jsx';
import SearchFilters from '../components/SearchFilters.jsx';
import PrivacyAmount from '../components/PrivacyAmount.jsx';
import { formatDate, formatDateTime } from '../utils/format.js';
import { showNotification } from '../components/Notification.jsx';

export default function Transactions({ onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filters, setFilters] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const editRequestIdRef = useRef(0);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.type && filters.type !== 'all') params.type = filters.type;
      if (filters.category && filters.category !== 'all') params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const data = await getTransactions(params);
      setTransactions(data);
    } catch (err) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleExportCsv = async () => {
    try {
      const blob = await exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spendwise-transactions.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotification('success', 'CSV exported successfully');
    } catch (err) {
      showNotification('error', err.message || 'Export failed');
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleDelete = async (id) => {
    try {
      await deleteTransaction(id);
      setTransactions(transactions.filter((t) => t.id !== id));
      setDeleteConfirm(null);
      showNotification('success', 'Transaction deleted');
    } catch (err) {
      showNotification('error', err.message || 'Failed to delete');
    }
  };

  const handleEdit = async (transaction) => {
    const requestId = ++editRequestIdRef.current;
    setEditingId(transaction.id);
    const baseData = {
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description || '',
      date: transaction.date,
      recurringId: transaction.recurring_id || null,
    };

    if (transaction.recurring_id) {
      try {
        const recurring = await getRecurringById(transaction.recurring_id);
        if (requestId === editRequestIdRef.current) {
          setEditFormData({
            ...baseData,
            frequency: recurring.frequency,
            nextOccurrence: recurring.next_occurrence,
          });
        }
      } catch (err) {
        if (requestId === editRequestIdRef.current) {
          setEditFormData(baseData);
        }
      }
    } else {
      setEditFormData(baseData);
    }
  };

  const handleUpdate = async (data) => {
    setSubmitting(true);
    try {
      const updateData = {
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        recurring_id: data.recurringId || null,
      };

      let updated;
      if (data.makeRecurring) {
        if (editFormData?.recurringId) {
          await updateRecurring(editFormData.recurringId, {
            description: data.description,
            type: data.type,
            amount: data.amount,
            category: data.category,
            frequency: data.frequency,
            nextOccurrence: data.nextOccurrence,
            isActive: true,
          });
          updated = await updateTransaction(editingId, updateData);
        } else {
          const recurring = await createRecurring({
            description: data.description,
            type: data.type,
            amount: data.amount,
            category: data.category,
            frequency: data.frequency,
            nextOccurrence: data.nextOccurrence,
            isActive: true,
          });
          updateData.recurring_id = recurring.id;
          updated = await updateTransaction(editingId, updateData);
        }
        showNotification('success', 'Transaction updated and recurring schedule saved!');
      } else {
        updated = await updateTransaction(editingId, updateData);
        showNotification('success', 'Transaction updated');
      }

      setTransactions(
        transactions.map((t) => (t.id === editingId ? updated : t))
      );
      setEditingId(null);
      setEditFormData(null);
    } catch (err) {
      showNotification('error', err.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && transactions.length === 0) {
    return <div className="loading">Loading transactions...</div>;
  }

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h2>Transactions</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('add')}>
            Add Transaction
          </button>
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            Export to CSV
          </button>
        </div>
      </div>

      <SearchFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({})}
      />

      {error && <div className="error-message">{error}</div>}

      {transactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions match your filters.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('add')}>
            Add Your First Transaction
          </button>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="transaction-card">
              {editingId === transaction.id ? (
                <div className="edit-section">
                  <h3>Edit Transaction</h3>
                  <TransactionForm
                    onSubmit={handleUpdate}
                    initialData={editFormData}
                    onCancel={() => {
                      setEditingId(null);
                      setEditFormData(null);
                    }}
                    loading={submitting || !editFormData}
                  />
                </div>
              ) : (
                <>
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
                      <div className="transaction-meta">
                        <span className="transaction-date">📅 {formatDate(transaction.date)}</span>
                        <span className="transaction-created">🕒 {formatDateTime(transaction.created_at)}</span>
                      </div>
                    </div>
                    <div className="transaction-actions">
                      <button className="btn btn-small btn-edit" onClick={() => handleEdit(transaction)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-small btn-delete"
                        onClick={() => setDeleteConfirm(transaction.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {deleteConfirm === transaction.id && (
                    <div className="delete-confirm">
                      <p>Are you sure you want to delete this transaction?</p>
                      <div className="confirm-actions">
                        <button className="btn btn-small btn-delete" onClick={() => handleDelete(transaction.id)}>
                          Yes, Delete
                        </button>
                        <button className="btn btn-small btn-secondary" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
