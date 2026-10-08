import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';
import { showNotification } from '../components/Notification.jsx';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const loadLogs = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLogs({ page, limit: pagination.limit });
      setLogs(data.logs || []);
      setPagination(data.pagination || { page, limit: 20, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
      showNotification('error', 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const actionLabels = {
    login: 'Successful login',
    login_failed: 'Failed login attempt',
    logout: 'Logout',
    register: 'Account registered',
    transaction_created: 'Transaction created',
    transaction_updated: 'Transaction updated',
    transaction_deleted: 'Transaction deleted',
    budget_created: 'Budget created',
    budget_updated: 'Budget updated',
    budget_deleted: 'Budget deleted',
    recurring_created: 'Recurring transaction created',
    recurring_updated: 'Recurring transaction updated',
    recurring_deleted: 'Recurring transaction deleted',
  };

  return (
    <div className="audit-log-page">
      <div className="page-header">
        <h2>Security Activity</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {logs.length === 0 ? (
        <div className="empty-state">
          <p>No activity logged yet.</p>
        </div>
      ) : (
        <>
          <div className="audit-list">
            {logs.map((log) => (
              <div key={log.id} className="audit-item">
                <div className="audit-action">{actionLabels[log.action] || log.action}</div>
                {log.resource && <span className={`audit-resource ${log.action.includes('login') ? 'auth' : 'data'}`}>{log.resource}</span>}
                {log.detail && <span className="audit-detail">{log.detail}</span>}
                <div className="audit-time">{formatDateTime(log.created_at)}</div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-small btn-secondary"
                onClick={() => loadLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page {pagination.page} of {totalPages}
              </span>
              <button
                className="btn btn-small btn-secondary"
                onClick={() => loadLogs(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
