import React, { useState, useEffect } from 'react';
import RecurringForm from '../components/RecurringForm.jsx';
import RecurringTransactionCard from '../components/RecurringTransactionCard.jsx';
import { showNotification } from '../components/Notification.jsx';
import {
  getRecurringTransactions,
  createRecurring,
  updateRecurring,
  deleteRecurring,
} from '../services/api.js';

export default function Recurring() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRecurringTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err.message || 'Failed to load recurring transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateRecurring(editingId, data);
        setTransactions(transactions.map((t) => (t.id === editingId ? updated : t)));
        showNotification('success', 'Recurring transaction updated');
      } else {
        const created = await createRecurring(data);
        setTransactions([created, ...transactions]);
        showNotification('success', 'Recurring transaction created');
      }
      setShowForm(false);
      setEditingId(null);
      setEditData(null);
    } catch (err) {
      showNotification('error', err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tx) => {
    setEditingId(tx.id);
    setEditData({
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      frequency: tx.frequency,
      next_occurrence: tx.next_occurrence,
      is_active: tx.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (tx) => {
    try {
      await deleteRecurring(tx.id);
      setTransactions(transactions.filter((t) => t.id !== tx.id));
      showNotification('success', 'Recurring transaction deleted');
    } catch (err) {
      showNotification('error', err.message || 'Failed to delete');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleToggle = async (tx) => {
    try {
      await updateRecurring(tx.id, {
        description: tx.description,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        frequency: tx.frequency,
        nextOccurrence: tx.next_occurrence,
        isActive: !tx.is_active,
      });
      setTransactions(
        transactions.map((t) => (t.id === tx.id ? { ...t, is_active: t.is_active ? 0 : 1 } : t))
      );
      showNotification('success', `Recurring transaction ${tx.is_active ? 'paused' : 'activated'}`);
    } catch (err) {
      showNotification('error', err.message || 'Failed to update');
    }
  };

  if (loading && transactions.length === 0) {
    return <div className="loading">Loading recurring transactions...</div>;
  }

  return (
    <div className="recurring-page">
      <div className="page-header">
        <h2>Recurring Transactions</h2>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setEditData(null); }}>
          Add Recurring
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="edit-section">
          <h3>{editingId ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}</h3>
          <RecurringForm
            initialData={editData}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingId(null); setEditData(null); }}
            loading={submitting}
          />
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state">
          <p>No recurring transactions set up yet.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Add Your First Recurring Transaction
          </button>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map((tx) => (
            <RecurringTransactionCard
              key={tx.id}
              transaction={tx}
              onEdit={handleEdit}
              onDelete={(t) => setDeleteConfirm(t)}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete "{deleteConfirm.description}"?</p>
            <div className="form-actions">
              <button className="btn btn-delete" onClick={() => handleDelete(deleteConfirm)}>
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
