import React from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

export default function ReadinessPanel({ coverage, onWhy }) {
  const { formatText } = usePrivacyFormat();

  if (!coverage) return null;

  const { tier, readiness = [], expenseMonths = 0, totalTransactions = 0 } = coverage;
  const available = readiness.filter((item) => item.status === 'available');
  const locked = readiness.filter((item) => item.status === 'locked');

  return (
    <section className="analysis-panel readiness-panel">
      <header className="panel-head">
        <h3>
          How deep the analysis goes
          <InfoHint label="About analysis depth">
            Each layer unlocks when the data can support it. Months are counted only when they
            contain expenses, so depth is earned by your history rather than time on the app.
          </InfoHint>
        </h3>
        {onWhy && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onWhy}>
            Why
          </button>
        )}
      </header>

      <div className="readiness-layout">
        <div className="tier-block">
          <div className="tier-heading">
            <span className={`tier-badge tier-${tier.level}`}>Tier {tier.level}</span>
            <strong>{tier.label}</strong>
          </div>
          <div className="tier-track" aria-hidden="true">
            {[0, 1, 2, 3].map((level) => (
              <span key={level} className={level <= tier.level ? 'filled' : ''} />
            ))}
          </div>
          <p className="tier-detail">{formatText(tier.detail)}</p>
          <div className="tier-stats">
            <span>{expenseMonths} month{expenseMonths === 1 ? '' : 's'} of expenses</span>
            <span>{totalTransactions} transactions</span>
          </div>
          {coverage.nextTier && (
            <p className="tier-next">
              Next: <strong>{coverage.nextTier.label}</strong> unlocks in{' '}
              {coverage.nextTier.monthsNeeded} more month
              {coverage.nextTier.monthsNeeded === 1 ? '' : 's'} with expenses.
            </p>
          )}
        </div>

        <div className="readiness-groups">
          <div className="readiness-group">
            <h4>Unlocked now</h4>
            <ul className="readiness-chips">
              {available.map((item) => (
                <li key={item.key} title={item.unlocks}>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          {locked.length > 0 && (
            <div className="readiness-group">
              <h4>Unlocks with more history</h4>
              <ul className="locked-list">
                {locked.map((item) => (
                  <li key={item.key}>
                    <span className="locked-label">{item.label}</span>
                    <span className="locked-missing">{formatText(item.missing.join(' · '))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
