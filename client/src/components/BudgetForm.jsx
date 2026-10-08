import React, { useState } from 'react';
import { categories } from '../utils/format.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function BudgetForm({ initialData, onSubmit, onCancel, loading }) {
  const [category, setCategory] = useState(initialData?.category || '');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [month, setMonth] = useState(initialData?.month || new Date().getMonth() + 1);
  const [year, setYear] = useState(initialData?.year || new Date().getFullYear());
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!category) newErrors.category = 'Category is required';
    if (!amount || Number(amount) <= 0) newErrors.amount = 'Amount must be greater than zero';
    if (!month) newErrors.month = 'Month is required';
    if (!year || year < 2000) newErrors.year = 'Invalid year';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;
    onSubmit({
      category,
      amount: Number(amount),
      month: Number(month),
      year: Number(year),
    });
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      {errors.form && <div className="error-message">{errors.form}</div>}

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setErrors({ ...errors, category: undefined }); }}
          disabled={loading}
        >
          <option value="">Select category</option>
          {categories.expense.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && <span className="form-error">{errors.category}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="amount">Budget Amount (₹)</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setErrors({ ...errors, amount: undefined }); }}
          placeholder="0.00"
          disabled={loading}
        />
        {errors.amount && <span className="form-error">{errors.amount}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="month">Month</label>
        <select
          id="month"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          disabled={loading}
        >
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="year">Year</label>
        <input
          id="year"
          type="number"
          min="2000"
          max="2100"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Budget' : 'Create Budget'}
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
