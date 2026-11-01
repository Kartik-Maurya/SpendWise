import React from 'react';
import { Link } from 'react-router-dom';
import AuditBadge, { AuditIcon } from './AuditBadge.jsx';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';
import {
  CATEGORY_LABELS,
  formatAuditFull,
  formatAuditTime,
  formatAuditUtc,
  parseAuditDate,
  recurringPostInfo,
} from '../../utils/audit.js';

function Chevron({ open }) {
  return (
    <svg
      className={`audit-chevron${open ? ' is-open' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function AuditEntry({ entry, expanded, onToggle }) {
  const { formatText } = usePrivacyFormat();
  const view = entry.view;
  const detailsId = entry.type === 'group' ? `audit-group-${entry.items[0].id}` : `audit-row-${entry.log.id}`;
  const date = entry.date;
  const fullTime = formatAuditFull(date);

  return (
    <li className={`audit-entry${view.warning ? ' is-warning' : ''}`}>
      <button
        type="button"
        className="audit-entry-main"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onToggle}
      >
        <AuditBadge
          tone={view.tone}
          icon={view.icon}
          label={view.badge}
          warning={view.warning}
        />

        <span className="audit-entry-content">
          <span className="audit-entry-title">
            {view.title}
            {view.warning && (
              <span className="audit-entry-warn" title="Destructive action">
                <AuditIcon name="alert" size={12} />
                <span className="sr-only">Destructive action</span>
              </span>
            )}
          </span>
          {view.description && (
            <span className="audit-entry-desc">{formatText(view.description)}</span>
          )}
        </span>

        <time
          className="audit-entry-time"
          dateTime={date ? date.toISOString() : undefined}
          title={fullTime}
        >
          {formatAuditTime(date)}
        </time>

        <Chevron open={expanded} />
      </button>

      {expanded && (
        <div className="audit-entry-details" id={detailsId}>
          {entry.type === 'group' ? (
            <>
              <p className="audit-detail-text">
                Recurring schedule #{entry.recurringId} posted these transactions:
              </p>
              <ul className="audit-group-list">
                {entry.items.map((item) => {
                  const info = recurringPostInfo(item.detail);
                  const itemDate = parseAuditDate(item.created_at);
                  return (
                    <li key={item.id}>
                      <span className="audit-mono">
                        {info ? `Transaction #${info.transactionId}` : 'Transaction'}
                      </span>
                      <span className="audit-group-time" title={formatAuditFull(itemDate)}>
                        {formatAuditTime(itemDate)}
                      </span>
                      <span className="audit-group-utc">{formatAuditUtc(itemDate)}</span>
                    </li>
                  );
                })}
              </ul>
              {view.link && (
                <Link className="audit-detail-link" to={view.link.to}>
                  {view.link.label} →
                </Link>
              )}
            </>
          ) : (
            <>
              <dl className="audit-detail-grid">
                <div>
                  <dt>Event</dt>
                  <dd>{entry.log.action}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{CATEGORY_LABELS[view.category]}</dd>
                </div>
                {entry.log.resource && (
                  <div>
                    <dt>Resource</dt>
                    <dd>{entry.log.resource}</dd>
                  </div>
                )}
                <div>
                  <dt>Recorded</dt>
                  <dd>
                    {fullTime}
                    <span className="audit-detail-utc">{formatAuditUtc(date)}</span>
                  </dd>
                </div>
                {entry.log.ip_address && (
                  <div>
                    <dt>IP address</dt>
                    <dd className="audit-mono">{entry.log.ip_address}</dd>
                  </div>
                )}
              </dl>

              {entry.log.detail && (
                <p className="audit-detail-text">{formatText(entry.log.detail)}</p>
              )}

              {view.link && (
                <Link className="audit-detail-link" to={view.link.to}>
                  {view.link.label} →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
