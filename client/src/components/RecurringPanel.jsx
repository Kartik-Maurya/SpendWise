import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RecurringForm from './RecurringForm.jsx';
import RecurringTransactionCard from './RecurringTransactionCard.jsx';
import CsvImportPanel from './CsvImportPanel.jsx';
import { showNotification } from './Notification.jsx';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
import { categories, formatDate } from '../utils/format.js';
import {
  getRecurringTransactions,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  bulkUpdateRecurring,
  bulkDeleteRecurring,
  importRecurring,
} from '../services/api.js';

export default function RecurringPanel() {
  const { formatDescription } = usePrivacyFormat();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEdit, setBulkEdit] = useState({ type: '', category: '', nextOccurrence: '' });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const selectAllRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRecurringTransactions();
      setTransactions(data);
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const visible = new Set(data.map((t) => t.id));
        const next = new Set([...prev].filter((id) => visible.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      setError(err.message || 'Failed to load recurring transactions');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setEditData(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditData(null);
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
      closeForm();
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
      setSelectedIds((prev) => {
        if (!prev.has(tx.id)) return prev;
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });
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

  const selectedTransactions = transactions.filter((t) => selectedIds.has(t.id));
  const selectedCount = selectedTransactions.length;
  const allSelected = transactions.length > 0 && selectedCount === transactions.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const clearSelection = () => setSelectedIds(new Set());

  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(transactions.map((t) => t.id)));
  };

  const openBulkEdit = () => {
    setBulkEdit({ type: '', category: '', nextOccurrence: '' });
    setBulkEditOpen(true);
  };

  const handleBulkTypeChange = (event) => {
    const type = event.target.value;
    setBulkEdit((prev) => {
      if (type && prev.category && !categories[type].includes(prev.category)) {
        return { ...prev, type, category: '' };
      }
      return { ...prev, type };
    });
  };

  const bulkHasChanges = Boolean(bulkEdit.type || bulkEdit.category || bulkEdit.nextOccurrence);
  const bulkConflicts = bulkHasChanges
    ? selectedTransactions.filter((t) => {
        const targetType = bulkEdit.type || t.type;
        const targetCategory = bulkEdit.category || t.category;
        return !categories[targetType].includes(targetCategory);
      })
    : [];
  const bulkSummary = [
    bulkEdit.type && `Type → ${bulkEdit.type === 'income' ? 'Income' : 'Expense'}`,
    bulkEdit.category && `Category → ${bulkEdit.category}`,
    bulkEdit.nextOccurrence && `Next occurrence → ${formatDate(bulkEdit.nextOccurrence)}`,
  ].filter(Boolean);

  const handleBulkUpdate = async () => {
    if (!bulkHasChanges || bulkConflicts.length > 0 || bulkSaving) return;

    setBulkSaving(true);
    try {
      const payload = { ids: selectedTransactions.map((t) => t.id) };
      if (bulkEdit.type) payload.type = bulkEdit.type;
      if (bulkEdit.category) payload.category = bulkEdit.category;
      if (bulkEdit.nextOccurrence) payload.nextOccurrence = bulkEdit.nextOccurrence;

      const result = await bulkUpdateRecurring(payload);
      setBulkEditOpen(false);
      clearSelection();
      await loadData();
      showNotification(
        'success',
        `${result.updated} recurring transaction${result.updated === 1 ? '' : 's'} updated`
      );
    } catch (err) {
      showNotification('error', err.message || 'Failed to update recurring transactions');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleting) return;

    setBulkDeleting(true);
    try {
      const ids = selectedTransactions.map((t) => t.id);
      const result = await bulkDeleteRecurring(ids);
      setTransactions(transactions.filter((t) => !selectedIds.has(t.id)));
      clearSelection();
      setBulkDeleteOpen(false);
      showNotification(
        'success',
        `${result.deleted} recurring transaction${result.deleted === 1 ? '' : 's'} deleted`
      );
    } catch (err) {
      showNotification('error', err.message || 'Failed to delete recurring transactions');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="recurring-panel">
      <div className="list-toolbar">
        <div className="list-toolbar-left">
          <label className="select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={transactions.length === 0}
              aria-label="Select all recurring transactions"
            />
            <span>Select all</span>
          </label>
          {selectedCount > 0 ? (
            <>
              <span className="selection-count">{selectedCount} selected</span>
              <div className="bulk-actions">
                <button className="btn btn-small btn-edit" onClick={openBulkEdit}>
                  Edit selected
                </button>
                <button
                  className="btn btn-small btn-delete"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Delete selected
                </button>
                <button className="btn btn-small btn-ghost" onClick={clearSelection}>
                  Clear
                </button>
              </div>
            </>
          ) : (
            <span className="toolbar-hint">
              {loading
                ? 'Loading schedules…'
                : `${transactions.length} recurring schedule${transactions.length === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            Add Recurring
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
          title="Import recurring schedules"
          hint="Use the header row from the Recurring CSV export: Type, Amount, Category, Description, Frequency, Next Occurrence, Status and Created At. Status may be Active or Paused; Created At is ignored. Schedules matching an existing type, amount, category, description, frequency, next date and status are skipped."
          footer={
            <>
              Header example: <code>Type,Amount,Category,Description,Frequency,Next Occurrence,Status,Created At</code>.
              Up to 5,000 rows or 2 MB per file. Recurring CSVs downloaded from Settings → Export &amp;
              backup can be re-imported here.
            </>
          }
          onImport={importRecurring}
          onImported={loadData}
          onClose={() => setImportOpen(false)}
        />
      )}

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="edit-section">
          <h3>{editingId ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}</h3>
          <RecurringForm
            initialData={editData}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            loading={submitting}
          />
        </div>
      )}

      {loading && transactions.length === 0 ? (
        <div className="loading">Loading recurring transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>No recurring transactions set up yet.</p>
          <button className="btn btn-primary" onClick={openCreate}>
            Add Your First Recurring Transaction
          </button>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map((tx) => (
            <RecurringTransactionCard
              key={tx.id}
              transaction={tx}
              selected={selectedIds.has(tx.id)}
              onSelect={toggleSelection}
              onEdit={handleEdit}
              onDelete={(t) => setDeleteConfirm(t)}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {bulkEditOpen && (
        <div className="modal-overlay">
          <div className="modal bulk-edit-modal">
            <h3>
              Edit {selectedCount} recurring transaction{selectedCount === 1 ? '' : 's'}
            </h3>
            <p className="bulk-edit-hint">
              Leave a field unchanged to keep each schedule&apos;s current value. Amount, description,
              frequency and active state stay per schedule.
            </p>

            <div className="bulk-edit-grid">
              <div className="form-group">
                <label htmlFor="bulk-recurring-type">Type</label>
                <select
                  id="bulk-recurring-type"
                  value={bulkEdit.type}
                  onChange={handleBulkTypeChange}
                  disabled={bulkSaving}
                >
                  <option value="">Leave unchanged</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="bulk-recurring-category">Category</label>
                <select
                  id="bulk-recurring-category"
                  value={bulkEdit.category}
                  onChange={(e) => setBulkEdit((prev) => ({ ...prev, category: e.target.value }))}
                  disabled={bulkSaving}
                >
                  <option value="">Leave unchanged</option>
                  {bulkEdit.type ? (
                    categories[bulkEdit.type].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))
                  ) : (
                    <>
                      <optgroup label="Income">
                        {categories.income.map((cat) => (
                          <option key={`income-${cat}`} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Expense">
                        {categories.expense.map((cat) => (
                          <option key={`expense-${cat}`} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="bulk-recurring-next">Next occurrence</label>
                <div className="bulk-date-row">
                  <input
                    id="bulk-recurring-next"
                    type="date"
                    value={bulkEdit.nextOccurrence}
                    onChange={(e) =>
                      setBulkEdit((prev) => ({ ...prev, nextOccurrence: e.target.value }))
                    }
                    disabled={bulkSaving}
                  />
                  {bulkEdit.nextOccurrence && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setBulkEdit((prev) => ({ ...prev, nextOccurrence: '' }))}
                      disabled={bulkSaving}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {bulkConflicts.length > 0 ? (
              <div className="error-message" role="alert">
                {bulkConflicts.length} of {selectedCount} selected recurring transaction(s) would keep
                a category that does not match the target type. Choose a category for that type.
              </div>
            ) : (
              bulkHasChanges && (
                <p className="bulk-edit-preview">
                  Apply {bulkSummary.join(' · ')} to {selectedCount} recurring transaction
                  {selectedCount === 1 ? '' : 's'}.
                </p>
              )
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkUpdate}
                disabled={!bulkHasChanges || bulkConflicts.length > 0 || bulkSaving}
              >
                {bulkSaving ? 'Applying…' : `Apply to ${selectedCount}`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBulkEditOpen(false)}
                disabled={bulkSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>
              Delete {selectedCount} recurring transaction{selectedCount === 1 ? '' : 's'}?
            </h3>
            <p>
              This permanently removes the selected schedules. Transactions already created from them
              are kept.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-delete"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedCount}`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete "{formatDescription(deleteConfirm.description)}"?</p>
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
