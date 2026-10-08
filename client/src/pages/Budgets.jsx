import React, { useState, useEffect } from 'react';
import BudgetCard from '../components/BudgetCard.jsx';
import BudgetForm from '../components/BudgetForm.jsx';
import PrivacyAmount from '../components/PrivacyAmount.jsx';
import { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetWarnings } from '../services/api.js';
import { showNotification } from '../components/Notification.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingBudget, setEditingBudget] = useState(null);
  const [deletingBudget, setDeletingBudget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [budgetsData, warningsData] = await Promise.allSettled([
        getBudgets({ month: selectedMonth, year: selectedYear }),
        getBudgetWarnings({ month: selectedMonth, year: selectedYear }),
      ]);
      setBudgets(budgetsData.status === 'fulfilled' ? budgetsData.value : []);
      setWarnings(warningsData.status === 'fulfilled' ? warningsData.value : []);
    } catch (err) {
      setError(err.message || 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (editingBudget) {
        const updated = await updateBudget(editingBudget.id, data);
        setBudgets(budgets.map((b) => (b.id === editingBudget.id ? updated : b)));
        showNotification('success', 'Budget updated');
      } else {
        const created = await createBudget(data);
        setBudgets([created, ...budgets]);
        showNotification('success', 'Budget created');
      }
      setShowForm(false);
      setEditingBudget(null);
    } catch (err) {
      showNotification('error', err.message || 'Failed to save budget');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (budget) => {
    try {
      await deleteBudget(budget.id);
      setBudgets(budgets.filter((b) => b.id !== budget.id));
      showNotification('success', 'Budget deleted');
    } catch (err) {
      showNotification('error', err.message || 'Failed to delete');
    } finally {
      setDeletingBudget(null);
    }
  };

  if (loading && budgets.length === 0) {
    return <div className="loading">Loading budgets...</div>;
  }

  return (
    <div className="budgets-page">
      <div className="page-header">
        <h2>Budgets</h2>
        <div className="page-actions">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="2000"
            max="2100"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ width: '80px' }}
          />
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingBudget(null); }}>
            Add Budget
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {warnings.length > 0 && (
        <div className="warnings-list">
          {warnings.map((w) => (
            <div key={w.budget_id} className={`warning-card warning-${w.status}`}>
              <strong>{w.category}</strong>: {w.message}
              <span className="warning-detail">
                <PrivacyAmount amount={w.spent} /> of <PrivacyAmount amount={w.budget_amount} /> used ({w.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {(showForm || editingBudget) && (
        <div className="edit-section">
          <h3>{editingBudget ? 'Edit Budget' : 'Add Budget'}</h3>
          <BudgetForm
            initialData={editingBudget}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingBudget(null); }}
            loading={submitting}
          />
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="empty-state">
          <p>No budgets set for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="budget-grid">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={(b) => { setEditingBudget(b); setShowForm(true); }}
              onDelete={() => setDeletingBudget(budget)}
            />
          ))}
        </div>
      )}

      {deletingBudget && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete the "{deletingBudget.category}" budget for {MONTH_NAMES[deletingBudget.month - 1]} {deletingBudget.year}?</p>
            <div className="form-actions">
              <button className="btn btn-delete" onClick={() => handleDelete(deletingBudget)}>
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setDeletingBudget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
