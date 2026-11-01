import React from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

const SEVERITY_LABEL = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export default function InsightFeed({ insights, onAction, onWhy }) {
  const { formatAmount, formatText } = usePrivacyFormat();

  if (!insights) return null;

  const items = insights.items || [];

  return (
    <section className="analysis-panel insight-panel">
      <header className="panel-head">
        <h3>
          What needs attention
          <InfoHint label="How findings are ranked">
            Ranked by severity, then amount. Open any item to see the evidence behind it.
          </InfoHint>
        </h3>
        <span className="panel-count">
          {insights.total} finding{insights.total === 1 ? '' : 's'}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="panel-empty">
          No budget overruns, unusual charges or savings risks were found for this month.
        </div>
      ) : (
        <ul className="insight-list">
          {items.map((item) => (
            <li key={item.id} className={`insight-item severity-${item.severity}`}>
              <div className="insight-body">
                <div className="insight-title-row">
                  <h4>{formatText(item.title)}</h4>
                  {item.amount > 0 && (
                    <span className="insight-amount">{formatAmount(item.amount)}</span>
                  )}
                </div>
                <p className="insight-detail">{formatText(item.detail)}</p>
                <div className="insight-meta">
                  <span className={`severity-chip severity-${item.severity}`}>
                    {SEVERITY_LABEL[item.severity] || item.severity}
                  </span>
                  {item.category && <span className="meta-chip">{item.category}</span>}
                  {item.confidence && (
                    <span className="meta-chip">Confidence: {item.confidence}</span>
                  )}
                </div>
              </div>
              <div className="insight-actions">
                {item.action && (
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() => onAction(item)}
                  >
                    {item.action.label}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => onWhy(item)}
                >
                  Why
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {insights.total > items.length && (
        <footer className="panel-foot">
          Showing the top {items.length} of {insights.total} findings.
        </footer>
      )}
    </section>
  );
}
