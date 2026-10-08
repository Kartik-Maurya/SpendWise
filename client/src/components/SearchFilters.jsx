import React from 'react';
import { categories } from '../utils/format.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

export default function SearchFilters({ filters, onChange, onReset }) {
  const allCategories = ['All', ...categories.expense, ...categories.income];

  const handleChange = (field, value) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <div className="search-filters">
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            type="text"
            placeholder="Description or category..."
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-type">Type</label>
          <select
            id="filter-type"
            value={filters.type || 'all'}
            onChange={(e) => handleChange('type', e.target.value || 'all')}
          >
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={filters.category || 'all'}
            onChange={(e) => handleChange('category', e.target.value || 'all')}
          >
            <option value="all">All Categories</option>
            {allCategories.slice(1).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-sort">Sort By</label>
          <select
            id="filter-sort"
            value={`${filters.sortBy || 'date'}-${filters.sortOrder || 'desc'}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              onChange({ ...filters, sortBy, sortOrder });
            }}
          >
            <option value="date-desc">Date (Newest first)</option>
            <option value="date-asc">Date (Oldest first)</option>
            <option value="amount-desc">Amount (Highest first)</option>
            <option value="amount-asc">Amount (Lowest first)</option>
          </select>
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="filter-start-date">From Date</label>
          <input
            id="filter-start-date"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleChange('startDate', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-end-date">To Date</label>
          <input
            id="filter-end-date"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleChange('endDate', e.target.value)}
          />
        </div>

        <div className="filter-group filter-group-inline">
          <button
            className="btn btn-secondary btn-small"
            onClick={onReset}
            type="button"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
