import React, { useState } from 'react';
import { getRecommendationTrail } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';
import { usePrivacyFormat } from '../contexts/PrivacyContext.jsx';
import InfoHint from '../components/InfoHint.jsx';
import { showNotification } from '../components/Notification.jsx';
import ActivityLog from '../components/audit/ActivityLog.jsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AuditLog() {
  const { formatAmount, formatText, privacyMode } = usePrivacyFormat();
  const [tab, setTab] = useState('activity');
  const [trail, setTrail] = useState(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState('');

  const loadTrail = async () => {
    setTrailLoading(true);
    setTrailError('');
    try {
      const data = await getRecommendationTrail({ limit: 20 });
      setTrail(data);
    } catch (err) {
      setTrailError(err.message || 'Failed to load the recommendation trail');
      showNotification('error', 'Failed to load the recommendation trail');
    } finally {
      setTrailLoading(false);
    }
  };

  const openTrail = () => {
    setTab('trail');
    loadTrail();
  };

  return (
    <div className="audit-log-page">
      <div className="page-header">
        <div>
          <h2>Audit Log</h2>
          <p className="page-subtitle">
            Sign-ins, data changes, exports and applied recommendations, recorded for accountability.
          </p>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Audit views">
        <button
          type="button"
          role="tab"
          id="audit-activity-tab"
          aria-selected={tab === 'activity'}
          aria-controls="audit-activity-panel"
          className={`page-tab ${tab === 'activity' ? 'active' : ''}`}
          onClick={() => setTab('activity')}
        >
          Activity
        </button>
        <button
          type="button"
          role="tab"
          id="audit-trail-tab"
          aria-selected={tab === 'trail'}
          aria-controls="audit-trail-panel"
          className={`page-tab ${tab === 'trail' ? 'active' : ''}`}
          onClick={openTrail}
        >
          Recommendation trail
        </button>
        <InfoHint label="About the recommendation trail">
          Every time a rebalancing proposal is applied, its reasons, confidence and evidence
          snapshot are stored. This trail shows what changed, in the order it happened.
        </InfoHint>
      </div>

      <div
        role="tabpanel"
        id="audit-activity-panel"
        aria-labelledby="audit-activity-tab"
        hidden={tab !== 'activity'}
      >
        <ActivityLog />
      </div>

      {tab === 'trail' && (
        <div role="tabpanel" id="audit-trail-panel" aria-labelledby="audit-trail-tab">
          {trailError && <div className="error-message">{trailError}</div>}

          {trailLoading && !trail ? (
            <div className="loading">Loading applied recommendations...</div>
          ) : !trail || !Array.isArray(trail.batches) || trail.batches.length === 0 ? (
            <div className="empty-state">
              <p>No recommendations have been applied yet.</p>
              <p className="empty-hint">
                Apply a rebalance from the Analytics page and the change will appear here with its
                evidence.
              </p>
            </div>
          ) : (
            <>
              <p className="audit-trail-summary">
                {trail.batches.length} of {trail.totalBatches} applied batch(es) shown, newest first.
              </p>
              <div className="trail-list">
                {trail.batches.map((batch) => (
                  <article key={batch.batchId} className="trail-card">
                    <header className="trail-head">
                      <div>
                        <h3>
                          {MONTH_NAMES[batch.month - 1]} {batch.year}
                        </h3>
                        <p className="trail-meta">
                          Applied {formatDateTime(batch.appliedAt)} ·{' '}
                          {batch.objective === 'overrun' ? 'avoid overruns' : 'save more'} ·{' '}
                          {batch.categories.length} categor
                          {batch.categories.length === 1 ? 'y' : 'ies'}
                        </p>
                      </div>
                      <div className="trail-totals">
                        <strong>{formatAmount(batch.totalProposed)}</strong>
                        <span>
                          net change {formatAmount(batch.totalDelta)} · batch{' '}
                          {String(batch.batchId).slice(0, 8)}
                        </span>
                      </div>
                    </header>

                    <div className="trail-rows">
                      {batch.categories.map((item) => (
                        <div key={`${batch.batchId}-${item.category}`} className="trail-row">
                          <div className="trail-row-head">
                            <span className="trail-cat">{item.category}</span>
                            <span className="trail-change">
                              {item.current === null ? 'No budget' : formatAmount(item.current)}
                              <span aria-hidden="true"> → </span>
                              <strong>
                                {item.proposed <= 0 ? 'Removed' : formatAmount(item.proposed)}
                              </strong>
                            </span>
                            {item.adjusted && (
                              <span className="trail-badge">
                                adjusted from{' '}
                                {item.recommended === null
                                  ? 'proposal'
                                  : formatAmount(item.recommended)}
                              </span>
                            )}
                            {item.confidence && (
                              <span className={`trail-confidence ${item.confidence}`}>
                                {item.confidence} confidence
                              </span>
                            )}
                          </div>
                          {item.reason && <p className="trail-reason">{formatText(item.reason)}</p>}
                          {item.evidence && (
                            <details className="trail-evidence">
                              <summary>Evidence snapshot</summary>
                              {privacyMode ? (
                                <p className="empty-hint">
                                  Evidence is hidden while privacy mode is on.
                                </p>
                              ) : (
                                <pre>{JSON.stringify(item.evidence, null, 2)}</pre>
                              )}
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
