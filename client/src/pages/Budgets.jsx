import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BudgetCard from '../components/BudgetCard.jsx';
import BudgetForm from '../components/BudgetForm.jsx';
import BudgetWarningCard from '../components/BudgetWarningCard.jsx';
import CsvImportPanel from '../components/CsvImportPanel.jsx';
import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetWarnings,
  importBudgets,
} from '../services/api.js';
import { showNotification } from '../components/Notification.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Budgets() {
  const navigate = useNavigate();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const minYear = currentYear - 5;
  const maxYear = currentYear + 5;

  const [budgets, setBudgets] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingBudget, setEditingBudget] = useState(null);
  const [deletingBudget, setDeletingBudget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;
  const atRangeStart = selectedYear <= minYear && selectedMonth === 1;
  const atRangeEnd = selectedYear >= maxYear && selectedMonth === 12;
  const yearOptions = [];
  for (let year = maxYear; year >= minYear; year -= 1) yearOptions.push(year);

  const updatePeriod = (month, year) => {
    if (year < minYear || year > maxYear) return;
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const shiftPeriod = (delta) => {
    const target = new Date(selectedYear, selectedMonth - 1 + delta, 1);
    updatePeriod(target.getMonth() + 1, target.getFullYear());
  };

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
        <div>
          <h2>Budgets</h2>
          <p className="page-subtitle">Monthly limits per category, with spend measured against them.</p>
        </div>
        <div className="page-actions">
          <div className="period-controls" aria-label="Budget period">
            <button
              type="button"
              className="period-arrow"
              onClick={() => shiftPeriod(-1)}
              disabled={atRangeStart}
              aria-label="Previous month"
            >
              ‹
            </button>
            <select
              aria-label="Budget month"
              value={selectedMonth}
              onChange={(e) => updatePeriod(Number(e.target.value), selectedYear)}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Budget year"
              value={selectedYear}
              onChange={(e) => updatePeriod(selectedMonth, Number(e.target.value))}
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
              disabled={atRangeEnd}
              aria-label="Next month"
            >
              ›
            </button>
            {!isCurrentMonth && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => updatePeriod(currentMonth, currentYear)}
              >
                Current month
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingBudget(null); }}>
            Add Budget
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setImportOpen((open) => !open)}
          >
            {importOpen ? 'Close Import' : 'Import CSV'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/settings')}>
            Export &amp; backup
          </button>
        </div>
      </div>

      {importOpen && (
        <CsvImportPanel
          title="Import budgets"
          hint="Use the header row from the Budgets CSV export: Month, Year, Category, Amount and Created At. Month is 1–12 and Created At is ignored. New month/category combinations are added; an existing one with a different amount is updated, and an identical row is skipped."
          footer={
            <>
              Header example: <code>Month,Year,Category,Amount,Created At</code>. Up to 5,000
              rows or 2 MB per file. Budgets CSVs downloaded from Settings → Export &amp; backup can
              be re-imported here.
            </>
          }
          onImport={importBudgets}
          onImported={loadData}
          onClose={() => setImportOpen(false)}
        />
      )}

      {error && <div className="error-message">{error}</div>}

      {warnings.length > 0 && (
        <div className="warnings-list">
          {warnings.map((w) => (
            <BudgetWarningCard key={w.budget_id} warning={w} />
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
