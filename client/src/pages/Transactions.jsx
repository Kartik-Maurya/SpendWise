import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTransactions,
  deleteTransaction,
  updateTransaction,
  bulkUpdateTransactions,
  bulkDeleteTransactions,
  getRecurringById,
  createRecurring,
  updateRecurring,
  importTransactions,
} from '../services/api.js';
import TransactionDialog from '../components/TransactionDialog.jsx';
import SearchFilters from '../components/SearchFilters.jsx';
import PrivacyAmount from '../components/PrivacyAmount.jsx';
import InfoHint from '../components/InfoHint.jsx';
import RecurringPanel from '../components/RecurringPanel.jsx';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
import { formatDate, formatDateTime, categories } from '../utils/format.js';
import { showNotification } from '../components/Notification.jsx';

export default function Transactions({ onAddTransaction, refreshToken }) {
  const { privacyMode, formatDescription } = usePrivacyFormat();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'recurring' ? 'recurring' : 'transactions';
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editDialog, setEditDialog] = useState(null);
  const [editLoadingId, setEditLoadingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filters, setFilters] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEdit, setBulkEdit] = useState({ type: '', category: '', date: '' });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const editRequestIdRef = useRef(0);
  const fileInputRef = useRef(null);
  const selectAllRef = useRef(null);

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
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const visible = new Set(data.map((t) => t.id));
        const next = new Set([...prev].filter((id) => visible.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, refreshToken]);

  const resetImport = () => {
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleImport = () => {
    if (importOpen) {
      resetImport();
      setImportOpen(false);
    } else {
      setImportOpen(true);
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setImportResult(null);
    setImportError('');

    if (file && file.size > 2 * 1024 * 1024) {
      setImportFile(null);
      setImportError('CSV files must be 2 MB or smaller');
      event.target.value = '';
      return;
    }
    setImportFile(file);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const csv = await importFile.text();
      const result = await importTransactions(csv);
      setImportResult(result);
      await loadTransactions();
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (result.imported > 0) {
        showNotification(
          'success',
          `Imported ${result.imported} transaction${result.imported === 1 ? '' : 's'}`
        );
      } else {
        showNotification(
          'success',
          result.duplicates > 0
            ? 'No new transactions: every row already exists'
            : 'No rows were imported'
        );
      }
    } catch (err) {
      setImportError(err.message || 'Import failed');
      showNotification('error', err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTransaction(id);
      setTransactions(transactions.filter((t) => t.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteConfirm(null);
      showNotification('success', 'Transaction deleted');
    } catch (err) {
      showNotification('error', err.message || 'Failed to delete');
    }
  };

  const handleEdit = async (transaction) => {
    const requestId = ++editRequestIdRef.current;
    setEditLoadingId(transaction.id);
    const baseData = {
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description || '',
      date: transaction.date,
      recurringId: transaction.recurring_id || null,
    };

    let formData = baseData;
    if (transaction.recurring_id) {
      try {
        const recurring = await getRecurringById(transaction.recurring_id);
        formData = {
          ...baseData,
          frequency: recurring.frequency,
          nextOccurrence: recurring.next_occurrence,
        };
      } catch (err) {
        formData = baseData;
      }
    }

    if (requestId !== editRequestIdRef.current) return;
    setEditLoadingId(null);
    setEditDialog({ transactionId: transaction.id, initialData: formData });
  };

  const closeEditDialog = () => {
    editRequestIdRef.current += 1;
    setEditLoadingId(null);
    setEditDialog(null);
  };

  const handleUpdate = async (data) => {
    if (!editDialog) return;
    const editingId = editDialog.transactionId;
    setSubmitting(true);
    try {
      const updateData = {
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        recurring_id: editDialog.initialData?.recurringId || null,
      };

      let updated;
      if (data.makeRecurring) {
        if (editDialog.initialData?.recurringId) {
          await updateRecurring(editDialog.initialData.recurringId, {
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

      setTransactions(transactions.map((t) => (t.id === editingId ? updated : t)));
      setEditDialog(null);
      setEditLoadingId(null);
    } finally {
      setSubmitting(false);
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

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setSelectedIds(new Set());
    setBulkEditOpen(false);
    setBulkDeleteOpen(false);
    closeEditDialog();
    setDeleteConfirm(null);
    setImportOpen(false);
    resetImport();
    setSearchParams(tab === 'recurring' ? { tab: 'recurring' } : {}, { replace: true });
  };

  const openBulkEdit = () => {
    setBulkEdit({ type: '', category: '', date: '' });
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

  const bulkHasChanges = Boolean(bulkEdit.type || bulkEdit.category || bulkEdit.date);
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
    bulkEdit.date && `Date → ${formatDate(bulkEdit.date)}`,
  ].filter(Boolean);

  const handleBulkUpdate = async () => {
    if (!bulkHasChanges || bulkConflicts.length > 0 || bulkSaving) return;

    setBulkSaving(true);
    try {
      const payload = { ids: selectedTransactions.map((t) => t.id) };
      if (bulkEdit.type) payload.type = bulkEdit.type;
      if (bulkEdit.category) payload.category = bulkEdit.category;
      if (bulkEdit.date) payload.date = bulkEdit.date;

      const result = await bulkUpdateTransactions(payload);
      setBulkEditOpen(false);
      clearSelection();
      await loadTransactions();
      showNotification(
        'success',
        `${result.updated} transaction${result.updated === 1 ? '' : 's'} updated`
      );
    } catch (err) {
      showNotification('error', err.message || 'Failed to update transactions');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleting) return;

    setBulkDeleting(true);
    try {
      const ids = selectedTransactions.map((t) => t.id);
      const result = await bulkDeleteTransactions(ids);
      setTransactions(transactions.filter((t) => !selectedIds.has(t.id)));
      clearSelection();
      setBulkDeleteOpen(false);
      showNotification(
        'success',
        `${result.deleted} transaction${result.deleted === 1 ? '' : 's'} deleted`
      );
    } catch (err) {
      showNotification('error', err.message || 'Failed to delete transactions');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="transactions-page">
      <div className="page-header">
        <div>
          <h2>Transactions</h2>
          <p className="page-subtitle">
            Every income and expense entry, plus the recurring schedules behind them.
          </p>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Transactions view">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'transactions'}
          className={`page-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => switchTab('transactions')}
        >
          Transactions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'recurring'}
          className={`page-tab ${activeTab === 'recurring' ? 'active' : ''}`}
          onClick={() => switchTab('recurring')}
        >
          Recurring
        </button>
      </div>

      {activeTab === 'recurring' ? (
        <RecurringPanel />
      ) : (
        <>
          <div className="list-toolbar">
            <div className="list-toolbar-left">
              <label className="select-all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={transactions.length === 0}
                  aria-label="Select all visible transactions"
                />
                <span>Select all</span>
              </label>
              {selectedCount > 0 && (
                <>
                  <span className="selection-count">
                    {selectedCount} selected
                  </span>
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
              )}
            </div>
            <div className="header-actions">
              <button className="btn btn-primary" onClick={() => onAddTransaction?.()}>
                Add Transaction
              </button>
              <button className="btn btn-secondary" onClick={toggleImport}>
                {importOpen ? 'Close Import' : 'Import CSV'}
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/settings')}>
                Export &amp; backup
              </button>
            </div>
          </div>

          {importOpen && (
            <section className="import-panel">
              <header className="panel-head">
                <h3>
                  Import from CSV
                  <InfoHint label="About CSV import">
                    Use a header row with Date, Type, Amount, Category and optionally Description. Dates
                    can be YYYY-MM-DD or DD/MM/YYYY. Type may be income, expense, credit or debit, and may
                    be omitted when the category makes it clear. Rows matching an existing transaction's
                    date, type, amount, category and description are skipped.
                  </InfoHint>
                </h3>
                <button type="button" className="btn btn-ghost btn-small" onClick={toggleImport}>
                  Close
                </button>
              </header>

              <div className="import-controls">
                <label className="import-file-label" htmlFor="csv-file">
                  Choose CSV
                </label>
                <input
                  ref={fileInputRef}
                  id="csv-file"
                  className="import-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={handleImport}
                  disabled={!importFile || importing}
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
                {importFile && (
                  <span className="import-file-name">
                    {importFile.name} · {Math.max(1, Math.round(importFile.size / 1024))} KB
                  </span>
                )}
              </div>

              <p className="import-hint">
                Header example: <code>Date,Type,Amount,Category,Description</code>. Up to 5,000 rows or
                2 MB per file. Valid rows are imported even when other rows are rejected, and every
                import is recorded in the audit log. Transactions CSVs downloaded from
                Settings → Export &amp; backup can be re-imported here.
              </p>

              {importError && (
                <div className="error-message" role="alert">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="import-result">
                  <div className="import-summary">
                    <span className="import-stat positive">{importResult.imported} imported</span>
                    <span className="import-stat">{importResult.duplicates} duplicate(s) skipped</span>
                    <span className="import-stat">{importResult.rejected} row(s) rejected</span>
                    <span className="import-stat muted">{importResult.totalRows} row(s) read</span>
                  </div>

                  {importResult.rejected > 0 && (
                    <details open={importResult.rejected <= 5}>
                      <summary>Rejected rows ({importResult.rejected})</summary>
                      <ul className="import-error-list">
                        {importResult.errors.map((item) => (
                          <li key={`err-${item.line}`}>
                            <span className="import-line">Row {item.line}</span>
                            {item.message}
                          </li>
                        ))}
                      </ul>
                      {importResult.rejected > importResult.errors.length && (
                        <p className="import-hint">
                          Showing the first {importResult.errors.length} rejected rows.
                        </p>
                      )}
                    </details>
                  )}

                  {importResult.duplicateRows && importResult.duplicateRows.length > 0 && (
                    <details>
                      <summary>Duplicate rows ({importResult.duplicates})</summary>
                      <ul className="import-error-list">
                        {importResult.duplicateRows.map((item) => (
                          <li key={`dup-${item.line}`}>
                            <span className="import-line">Row {item.line}</span>
                            {item.date} · {item.type} · {item.category} ·{' '}
                            <PrivacyAmount amount={item.amount} />
                            {item.description ? ` · ${formatDescription(item.description)}` : ''}
                          </li>
                        ))}
                      </ul>
                      {importResult.duplicates > importResult.duplicateRows.length && (
                        <p className="import-hint">
                          Showing the first {importResult.duplicateRows.length} duplicates.
                        </p>
                      )}
                    </details>
                  )}
                </div>
              )}
            </section>
          )}

          <SearchFilters
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters({})}
          />

          {error && <div className="error-message">{error}</div>}

          {loading && transactions.length === 0 ? (
            <div className="loading">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">
              <p>No transactions match your filters.</p>
              <button className="btn btn-primary" onClick={() => onAddTransaction?.()}>
                Add Your First Transaction
              </button>
            </div>
          ) : (
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`transaction-card ${
                    selectedIds.has(transaction.id) ? 'selected' : ''
                  }`}
                >
                  <div className="transaction-header">
                    <div className="transaction-header-main">
                      <label className="transaction-select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(transaction.id)}
                          onChange={() => toggleSelection(transaction.id)}
                          aria-label={`Select ${transaction.category} transaction from ${formatDate(
                            transaction.date
                          )}`}
                        />
                      </label>
                      <span className={`transaction-type ${transaction.type}`}>
                        {transaction.type === 'income' ? '↑ Income' : '↓ Expense'}
                      </span>
                    </div>
                    <span className={`transaction-amount ${transaction.type}`}>
                      <PrivacyAmount
                        amount={transaction.amount}
                        prefix={transaction.type === 'income' ? '+' : '-'}
                      />
                    </span>
                  </div>
                  <div className="transaction-body">
                    <div className="transaction-details">
                      <div className="transaction-category">{transaction.category}</div>
                      {transaction.description && (
                        <div className="transaction-description">
                          {formatDescription(transaction.description)}
                        </div>
                      )}
                      <div className="transaction-meta">
                        <span className="transaction-date">📅 {formatDate(transaction.date)}</span>
                        <span className="transaction-created">🕒 {formatDateTime(transaction.created_at)}</span>
                      </div>
                    </div>
                    <div className="transaction-actions">
                      <button
                        className="btn btn-small btn-edit"
                        onClick={() => handleEdit(transaction)}
                        disabled={editLoadingId === transaction.id}
                      >
                        {editLoadingId === transaction.id ? 'Loading…' : 'Edit'}
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
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {bulkEditOpen && (
        <div className="modal-overlay">
          <div className="modal bulk-edit-modal">
            <h3>
              Edit {selectedCount} transaction{selectedCount === 1 ? '' : 's'}
            </h3>
            <p className="bulk-edit-hint">
              Leave a field unchanged to keep each transaction&apos;s current value. Amount and
              description stay per transaction.
            </p>

            <div className="bulk-edit-grid">
              <div className="form-group">
                <label htmlFor="bulk-type">Type</label>
                <select
                  id="bulk-type"
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
                <label htmlFor="bulk-category">Category</label>
                <select
                  id="bulk-category"
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
                <label htmlFor="bulk-date">Date</label>
                <div className="bulk-date-row">
                  <input
                    id="bulk-date"
                    type="date"
                    value={bulkEdit.date}
                    onChange={(e) => setBulkEdit((prev) => ({ ...prev, date: e.target.value }))}
                    disabled={bulkSaving}
                  />
                  {bulkEdit.date && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setBulkEdit((prev) => ({ ...prev, date: '' }))}
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
                {bulkConflicts.length} of {selectedCount} selected transaction(s) would keep a
                category that does not match the target type. Choose a category for that type.
              </div>
            ) : (
              bulkHasChanges && (
                <p className="bulk-edit-preview">
                  Apply {bulkSummary.join(' · ')} to {selectedCount} transaction
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
              Delete {selectedCount} transaction{selectedCount === 1 ? '' : 's'}?
            </h3>
            <p>
              This permanently removes the selected entries. Recurring schedules stay in place.
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

      <TransactionDialog
        open={Boolean(editDialog)}
        mode="edit"
        initialData={editDialog?.initialData}
        onSubmit={handleUpdate}
        onClose={closeEditDialog}
        loading={submitting}
      />
    </div>
  );
}
