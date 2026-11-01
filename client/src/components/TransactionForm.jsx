import React, { useState } from 'react';
import { categories, todayInputValue } from '../utils/format.js';

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function TransactionForm({
  onSubmit,
  initialData,
  onCancel,
  loading,
  submitLabel,
  error,
}) {
  const [type, setType] = useState(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.date || todayInputValue());

  const [makeRecurring, setMakeRecurring] = useState(!!initialData?.recurringId);
  const [frequency, setFrequency] = useState(initialData?.frequency || 'weekly');
  const [nextOccurrence, setNextOccurrence] = useState(initialData?.nextOccurrence || date);

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Amount must be greater than zero';
    if (!category) newErrors.category = 'Category is required';
    if (!date) newErrors.date = 'Date is required';
    if (makeRecurring && !frequency) newErrors.frequency = 'Frequency is required';
    if (makeRecurring && !nextOccurrence) newErrors.nextOccurrence = 'Next occurrence is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    const data = {
      type,
      amount: parseFloat(amount),
      category,
      description,
      date,
    };

    if (makeRecurring) {
      data.makeRecurring = true;
      data.frequency = frequency;
      data.nextOccurrence = nextOccurrence;
    }

    onSubmit(data);
  };

  const handleTypeChange = (nextType) => {
    if (nextType === type) return;
    setType(nextType);
    setCategory('');
    setErrors({});
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
    if (errors.date) {
      setErrors((prev) => ({ ...prev, date: undefined }));
    }
    if (!makeRecurring) {
      setNextOccurrence(e.target.value);
    }
  };

  const handleMakeRecurringChange = (e) => {
    const checked = e.target.checked;
    setMakeRecurring(checked);
    if (checked && !nextOccurrence) {
      setNextOccurrence(date);
    }
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="txn-type-toggle" role="group" aria-label="Transaction type">
        <button
          type="button"
          className={`txn-type-option expense ${type === 'expense' ? 'active' : ''}`}
          aria-pressed={type === 'expense'}
          onClick={() => handleTypeChange('expense')}
          disabled={loading}
        >
          <span aria-hidden="true">↓</span> Expense
        </button>
        <button
          type="button"
          className={`txn-type-option income ${type === 'income' ? 'active' : ''}`}
          aria-pressed={type === 'income'}
          onClick={() => handleTypeChange('income')}
          disabled={loading}
        >
          <span aria-hidden="true">↑</span> Income
        </button>
      </div>

      <div className="txn-form-grid">
        <div className="form-group">
          <label htmlFor="amount">Amount</label>
          <div className="amount-field">
            <span className="amount-prefix" aria-hidden="true">₹</span>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) {
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }
              }}
              placeholder="0.00"
              disabled={loading}
              autoFocus
            />
          </div>
          {errors.amount && <span className="form-error">{errors.amount}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (errors.category) {
                setErrors((prev) => ({ ...prev, category: undefined }));
              }
            }}
            disabled={loading}
          >
            <option value="">Select category</option>
            {categories[type].map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && <span className="form-error">{errors.category}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={handleDateChange}
            disabled={loading}
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description">
            Description <span className="label-optional">optional</span>
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Groceries at DMart"
            disabled={loading}
            maxLength={500}
          />
        </div>
      </div>

      <label className={`recurring-toggle ${makeRecurring ? 'on' : ''}`}>
        <input
          type="checkbox"
          checked={makeRecurring}
          onChange={handleMakeRecurringChange}
          disabled={loading}
        />
        <span className="recurring-toggle-text">
          <span className="recurring-toggle-title">Repeat this transaction</span>
          <span className="recurring-toggle-hint">
            Save it as a recurring schedule so upcoming entries are added automatically.
          </span>
        </span>
      </label>

      {makeRecurring && (
        <div className="recurring-fields">
          <div className="form-group">
            <label htmlFor="frequency">Frequency</label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => { setFrequency(e.target.value); setErrors({ ...errors, frequency: undefined }); }}
              disabled={loading}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {errors.frequency && <span className="form-error">{errors.frequency}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="nextOccurrence">Next Occurrence</label>
            <input
              id="nextOccurrence"
              type="date"
              value={nextOccurrence}
              onChange={(e) => { setNextOccurrence(e.target.value); setErrors({ ...errors, nextOccurrence: undefined }); }}
              disabled={loading}
            />
            {errors.nextOccurrence && <span className="form-error">{errors.nextOccurrence}</span>}
          </div>
        </div>
      )}

      <div className="form-actions txn-form-actions">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : submitLabel || (initialData ? 'Save changes' : 'Add transaction')}
        </button>
      </div>
    </form>
  );
}
