import React, { useEffect, useMemo, useRef, useState } from 'react';
import { downloadAuditCsv, getAuditLogs } from '../../services/api.js';
import { showNotification } from '../Notification.jsx';
import AuditEntry from './AuditEntry.jsx';
import { AuditIcon } from './AuditBadge.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import {
  AUDIT_CHIPS,
  buildEntries,
  formatDateRange,
  groupEntriesByDay,
  isoStartOfDay,
  isoStartOfNextDay,
} from '../../utils/audit.js';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = { search: '', categories: [], from: '', to: '', sort: 'newest' };
const EMPTY_COUNTS = { all: 0, auth: 0, data: 0, recommendation: 0, export: 0, demo: 0 };

function filterParams(filters) {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.categories.length) params.categories = filters.categories.join(',');
  if (filters.from) params.from = isoStartOfDay(filters.from);
  if (filters.to) params.to = isoStartOfNextDay(filters.to);
  if (filters.sort === 'oldest') params.sort = 'oldest';
  return params;
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </svg>
  );
}

function SkeletonRows() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading activity…</span>
      <ul className="audit-list audit-skeleton-list" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="audit-entry audit-skeleton">
            <span className="audit-skeleton-badge" />
            <span className="audit-skeleton-content">
              <span className="audit-skeleton-line" />
              <span className="audit-skeleton-line short" />
            </span>
            <span className="audit-skeleton-time" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function entryKey(entry) {
  return entry.type === 'group'
    ? `g-${entry.recurringId}-${entry.items[0].id}`
    : `s-${entry.log.id}`;
}

export default function ActivityLog() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError('');
    setExpanded(new Set());

    getAuditLogs({ page: 1, limit: PAGE_SIZE, ...filterParams(filters) })
      .then((data) => {
        if (requestId !== requestRef.current) return;
        setLogs(data.logs || []);
        setCounts((current) => ({ ...current, ...(data.counts || {}) }));
        setPagination(data.pagination || { page: 1, total: 0, totalPages: 1 });
      })
      .catch((err) => {
        if (requestId !== requestRef.current) return;
        setError(err.message || 'Failed to load audit logs');
        setLogs([]);
        setPagination({ page: 1, total: 0, totalPages: 1 });
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [filters]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === filters.search) return undefined;
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, search: next }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  const days = useMemo(() => groupEntriesByDay(buildEntries(logs)), [logs]);

  const hasFilters =
    Boolean(filters.search) || filters.categories.length > 0 || Boolean(filters.from) || Boolean(filters.to);

  const setCategory = (key) => {
    setFilters((current) => {
      const categories = current.categories.includes(key)
        ? current.categories.filter((item) => item !== key)
        : [...current.categories, key];
      return { ...current, categories };
    });
  };

  const removeCategory = (key) => {
    setFilters((current) => ({
      ...current,
      categories: current.categories.filter((item) => item !== key),
    }));
  };

  const clearSearch = () => {
    setSearchInput('');
    setFilters((current) => ({ ...current, search: '' }));
  };

  const clearAll = () => {
    setSearchInput('');
    setFilters({ ...EMPTY_FILTERS });
  };

  const retry = () => {
    setFilters((current) => ({ ...current }));
  };

  const toggleEntry = (key) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadMore = async () => {
    if (loadingMore || loading) return;
    const requestId = requestRef.current;
    setLoadingMore(true);
    try {
      const data = await getAuditLogs({
        page: (pagination.page || 1) + 1,
        limit: PAGE_SIZE,
        ...filterParams(filters),
      });
      if (requestId !== requestRef.current) return;
      setLogs((current) => [...current, ...(data.logs || [])]);
      setPagination(data.pagination || pagination);
      if (data.counts) setCounts((current) => ({ ...current, ...data.counts }));
    } catch (err) {
      showNotification('error', err.message || 'Failed to load more activity');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await downloadAuditCsv(filterParams(filters));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification('error', err.message || 'Audit log export failed');
    } finally {
      setExporting(false);
    }
  };

  const remaining = Math.max(0, pagination.total - logs.length);

  return (
    <div className="audit-activity">
      <div className="audit-filter-bar">
        <div className="audit-filter-row">
          <div className="audit-search-field">
            <span className="audit-search-icon">
              <SearchIcon />
            </span>
            <input
              id="audit-search"
              name="search"
              type="search"
              className="audit-control audit-search-input"
              placeholder="Search activity"
              aria-label="Search activity"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="audit-search-clear"
                aria-label="Clear search"
                onClick={clearSearch}
              >
                ×
              </button>
            )}
          </div>

          <DateRangePicker
            from={filters.from}
            to={filters.to}
            onChange={({ from, to }) =>
              setFilters((current) => ({ ...current, from, to }))
            }
          />

          <button
            type="button"
            className="btn btn-secondary btn-small audit-export-btn"
            onClick={handleExport}
            disabled={exporting}
          >
            <AuditIcon name="download" size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        <div className="audit-filter-row audit-filter-row-secondary">
          <div className="audit-chips" role="group" aria-label="Filter by category">
            {AUDIT_CHIPS.map((chip) => {
              const count = counts[chip.key] ?? 0;
              const selected =
                chip.key === 'all'
                  ? filters.categories.length === 0
                  : filters.categories.includes(chip.key);
              const disabled = chip.key !== 'all' && count === 0 && !selected;

              return (
                <button
                  key={chip.key}
                  type="button"
                  className={`filter-chip${selected ? ' active' : ''}${disabled ? ' is-empty' : ''}`}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() =>
                    chip.key === 'all'
                      ? setFilters((current) => ({ ...current, categories: [] }))
                      : setCategory(chip.key)
                  }
                >
                  {chip.label}
                  <span className="chip-count">{count}</span>
                </button>
              );
            })}
          </div>

          <label className="audit-sort">
            <span className="sr-only">Sort order</span>
            <select
              id="audit-sort"
              name="sort"
              className="audit-control audit-sort-select"
              value={filters.sort}
              onChange={(event) =>
                setFilters((current) => ({ ...current, sort: event.target.value }))
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        {hasFilters && (
          <div className="audit-filter-row audit-filter-row-active">
            <span className="audit-result-count">
              Showing {logs.length} of {pagination.total}
            </span>
            <div className="audit-active-pills">
              {filters.search && (
                <button type="button" className="audit-pill" onClick={clearSearch}>
                  “{filters.search}”
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Remove search filter</span>
                </button>
              )}
              {filters.categories.map((key) => {
                const chip = AUDIT_CHIPS.find((item) => item.key === key);
                return (
                  <button
                    key={key}
                    type="button"
                    className="audit-pill"
                    onClick={() => removeCategory(key)}
                  >
                    {chip ? chip.label : key}
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">Remove category filter</span>
                  </button>
                );
              })}
              {(filters.from || filters.to) && (
                <button
                  type="button"
                  className="audit-pill"
                  onClick={() => setFilters((current) => ({ ...current, from: '', to: '' }))}
                >
                  {formatDateRange(filters.from, filters.to)}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Remove date filter</span>
                </button>
              )}
            </div>
            <button type="button" className="audit-clear-all" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message audit-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-small" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {loading && logs.length === 0 ? (
        <SkeletonRows />
      ) : !error && logs.length === 0 ? (
        <div className="empty-state">
          <p>{hasFilters ? 'No activity matches these filters.' : 'No activity logged yet.'}</p>
          {hasFilters ? (
            <button type="button" className="btn btn-secondary btn-small" onClick={clearAll}>
              Clear filters
            </button>
          ) : (
            <p className="empty-hint">
              Sign-ins, edits, imports and exports will appear here as you use SpendWise.
            </p>
          )}
        </div>
      ) : (
        !error && (
          <>
            <div className="audit-timeline" aria-busy={loading}>
              {days.map((day) => (
                <section key={day.key} className="audit-day">
                  <h3 className="audit-day-head">
                    {day.label}
                    <span>{day.count}</span>
                  </h3>
                  <ul className="audit-list">
                    {day.entries.map((entry) => {
                      const key = entryKey(entry);
                      return (
                        <AuditEntry
                          key={key}
                          entry={entry}
                          expanded={expanded.has(key)}
                          onToggle={() => toggleEntry(key)}
                        />
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>

            {remaining > 0 && (
              <div className="audit-load-more">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? 'Loading…'
                    : `Load ${Math.min(PAGE_SIZE, remaining)} more`}
                </button>
                <span className="audit-load-more-count">
                  Showing {logs.length} of {pagination.total}
                </span>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
