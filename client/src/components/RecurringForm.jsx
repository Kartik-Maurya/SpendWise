import React, { useState } from 'react';
import { categories } from '../utils/format.js';

export default function RecurringForm({ initialData, onSubmit, onCancel, loading }) {
  const [description, setDescription] = useState(initialData?.description || '');
  const [type, setType] = useState(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [frequency, setFrequency] = useState(initialData?.frequency || 'monthly');
  const [nextOccurrence, setNextOccurrence] = useState(initialData?.next_occurrence || new Date().toISOString().split('T')[0]);
  const [isActive, setIsActive] = useState(initialData?.is_active !== 0);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!amount || Number(amount) <= 0) newErrors.amount = 'Amount must be greater than zero';
    if (!category) newErrors.category = 'Category is required';
    if (!['weekly', 'monthly', 'yearly'].includes(frequency)) newErrors.frequency = 'Invalid frequency';
    if (!nextOccurrence) newErrors.nextOccurrence = 'Next occurrence is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;
    onSubmit({
      description,
      type,
      amount: Number(amount),
      category,
      frequency,
      nextOccurrence,
      isActive,
    });
  };

  const handleTypeChange = (e) => {
    setType(e.target.value);
    setCategory('');
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      {errors.form && <div className="error-message">{errors.form}</div>}

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Monthly Salary"
          disabled={loading}
          maxLength={200}
        />
        {errors.description && <span className="form-error">{errors.description}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="type">Type</label>
        <select id="type" value={type} onChange={handleTypeChange} disabled={loading}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Amount (₹)</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          disabled={loading}
        />
        {errors.amount && <span className="form-error">{errors.amount}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading}>
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
        <label htmlFor="frequency">Frequency</label>
        <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} disabled={loading}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="nextOccurrence">Next Occurrence</label>
        <input
          id="nextOccurrence"
          type="date"
          value={nextOccurrence}
          onChange={(e) => setNextOccurrence(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={loading}
          />
          <span>Active</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update' : 'Create'} Recurring Transaction
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
