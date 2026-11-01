import React, { useEffect, useRef } from 'react';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

const NON_CURRENCY_LABEL = /day|month|week|year|fold|count|transaction|observation|percent|rate|score|ratio|share|history/i;

function formatEntry(formatAmount, formatText, value, label, unit) {
  if (typeof value !== 'number') return formatText(value);
  if (unit && !String(unit).includes('INR')) return `${value} ${unit}`.trim();
  if (NON_CURRENCY_LABEL.test(label || '')) return String(value);
  return formatAmount(value);
}

function ProofDetails({ proof }) {
  const { formatAmount, formatText, privacyMode } = usePrivacyFormat();

  const renderedValue =
    typeof proof.value === 'number' && (!proof.unit || proof.unit.includes('INR'))
      ? formatAmount(proof.value)
      : formatText(proof.value);

  return (
    <section className="proof-block">
      <div className="proof-block-head">
        <span className="proof-eyebrow">How this was calculated</span>
        {proof.confidence && (
          <span className={`confidence confidence-${proof.confidence.level}`}>
            {proof.confidence.level} confidence
          </span>
        )}
      </div>
      <p className="proof-method">{formatText(proof.method)}</p>
      {proof.value !== undefined && proof.value !== null && (
        <div className="proof-value">
          {renderedValue}
          {proof.unit && !proof.unit.includes('INR') && <span> {proof.unit}</span>}
        </div>
      )}
      {proof.confidence && proof.confidence.reason && (
        <p className="proof-note">{formatText(proof.confidence.reason)}</p>
      )}
      {Array.isArray(proof.inputs) && proof.inputs.length > 0 && (
        <div className="proof-section">
          <h4>Inputs</h4>
          <dl className="proof-inputs">
            {proof.inputs.map((entry, index) => (
              <div key={`${entry.label}-${index}`} className="proof-input">
                <dt>{formatText(entry.label)}</dt>
                <dd>
                  {formatEntry(formatAmount, formatText, entry.value, entry.label, entry.unit)}
                  {entry.ref && <span className="proof-ref">{entry.ref}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {Array.isArray(proof.assumptions) && proof.assumptions.length > 0 && (
        <div className="proof-section">
          <h4>Assumptions</h4>
          <ul className="proof-assumptions">
            {proof.assumptions.map((assumption) => (
              <li key={assumption}>{formatText(assumption)}</li>
            ))}
          </ul>
        </div>
      )}
      {proof.trace &&
        (privacyMode ? (
          <p className="privacy-note">Calculation trace is hidden while privacy mode is on.</p>
        ) : (
          <details className="raw-details">
            <summary>Calculation trace</summary>
            <pre>{JSON.stringify(proof.trace, null, 2)}</pre>
          </details>
        ))}
      {proof.computed_at && <p className="proof-timestamp">Computed {proof.computed_at}</p>}
    </section>
  );
}

export default function ProofDrawer({ drawer, onClose }) {
  const closeRef = useRef(null);
  const { formatAmount, formatText, privacyMode } = usePrivacyFormat();

  useEffect(() => {
    if (!drawer) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [drawer, onClose]);

  if (!drawer) return null;

  const { title, subtitle, proof, rows = [], raw, rawLabel = 'Raw evidence' } = drawer;

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-drawer-title"
      >
        <header className="drawer-header">
          <div>
            <h3 id="proof-drawer-title">{formatText(title)}</h3>
            {subtitle && <p>{formatText(subtitle)}</p>}
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Close details"
          >
            ×
          </button>
        </header>
        <div className="drawer-body">
          {proof && <ProofDetails proof={proof} />}
          {rows.length > 0 && (
            <dl className="drawer-rows">
              {rows.map((row) => (
                <div key={row.label} className="drawer-row">
                  <dt>{row.label}</dt>
                  <dd>{formatEntry(formatAmount, formatText, row.value, row.label)}</dd>
                </div>
              ))}
            </dl>
          )}
          {raw && !privacyMode && (
            <details className="raw-details">
              <summary>{rawLabel}</summary>
              <pre>{JSON.stringify(raw, null, 2)}</pre>
            </details>
          )}
          {raw && privacyMode && (
            <p className="privacy-note">Raw evidence is hidden while privacy mode is on.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
