import React, { useEffect, useMemo, useState } from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacy, usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

function round2(value) {
  return Math.round(value * 100) / 100;
}

function lowerBound(item) {
  return item.essential ? Number(item.floor) : 0;
}

function upperBound(item) {
  return Math.max(lowerBound(item), Number(item.cap));
}

export default function RecommendationPanel({
  recommendation,
  canApply = true,
  onObjectiveChange,
  onApply,
  onWhyCategory,
  onWhy,
  onEditPlan,
  applying,
  objectiveBusy,
  applyWarnings = [],
}) {
  const { formatAmount, formatText } = usePrivacyFormat();
  const { privacyMode, setPrivacyMode } = usePrivacy();
  const [amounts, setAmounts] = useState({});
  const [selected, setSelected] = useState({});

  const categories = useMemo(
    () => (recommendation && recommendation.categories ? recommendation.categories : []),
    [recommendation]
  );

  useEffect(() => {
    const nextAmounts = {};
    const nextSelected = {};
    categories.forEach((item) => {
      nextAmounts[item.category] = Number(item.target);
      nextSelected[item.category] =
        Math.abs(Number(item.target) - Number(item.currentBudget || 0)) > 0.01;
    });
    setAmounts(nextAmounts);
    setSelected(nextSelected);
  }, [recommendation, categories]);

  if (!recommendation) return null;

  const objective = recommendation.objective || 'savings';
  const status = recommendation.status;
  const envelope = Number(recommendation.envelope || 0);

  const entries = categories
    .filter((item) => selected[item.category])
    .map((item) => ({
      category: item.category,
      amount: Number(amounts[item.category] ?? item.target),
    }));

  const planTotal = categories.reduce(
    (sum, item) => sum + Number(amounts[item.category] ?? item.target),
    0
  );
  const planRemaining = round2(envelope - planTotal);
  const selectedTotal = round2(entries.reduce((sum, entry) => sum + entry.amount, 0));
  const allSelected = categories.length > 0 && categories.every((item) => selected[item.category]);

  const toggleAll = () => {
    const next = {};
    categories.forEach((item) => {
      next[item.category] = !allSelected;
    });
    setSelected(next);
  };

  const updateAmount = (item, rawValue) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const bounded = Math.min(upperBound(item), Math.max(lowerBound(item), parsed));
    setAmounts((current) => ({ ...current, [item.category]: round2(bounded) }));
  };

  const header = (
    <header className="panel-head reco-head">
      <h3>
        Rebalance the month
        <InfoHint label="How targets are built">
          Floors protect essential categories and caps stop one category from absorbing the
          envelope. Save more leans on discretionary targets; Avoid overruns follows the forecast.
          Targets stay within 20% of current budgets unless the envelope makes that impossible.
        </InfoHint>
      </h3>
      <div className="reco-head-actions">
        <div className="objective-switch" role="group" aria-label="Monthly objective">
          <button
            type="button"
            className={objective === 'savings' ? 'active' : ''}
            aria-pressed={objective === 'savings'}
            disabled={objectiveBusy}
            onClick={() => onObjectiveChange('savings')}
          >
            Save more
          </button>
          <button
            type="button"
            className={objective === 'overrun' ? 'active' : ''}
            aria-pressed={objective === 'overrun'}
            disabled={objectiveBusy}
            onClick={() => onObjectiveChange('overrun')}
          >
            Avoid overruns
          </button>
        </div>
        {onWhy && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onWhy}>
            How
          </button>
        )}
      </div>
    </header>
  );

  if (status !== 'available') {
    return (
      <section className="analysis-panel recommendation-panel" id="rebalance">
        {header}
        <div className="locked-banner">
          <h4>Budget recommendation is not ready</h4>
          <p>{formatText(recommendation.reason)}</p>
          {Array.isArray(recommendation.missing) && recommendation.missing.length > 0 && (
            <ul className="missing-list">
              {recommendation.missing.map((item) => (
                <li key={item}>{formatText(item)}</li>
              ))}
            </ul>
          )}
          <div className="locked-actions">
            <button type="button" className="btn btn-secondary btn-small" onClick={onEditPlan}>
              Edit the monthly plan
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="analysis-panel recommendation-panel" id="rebalance">
      {header}

      <div className="summary-chips">
        <div className="summary-chip">
          <span>Income used</span>
          <strong>{formatAmount(recommendation.income ? recommendation.income.value : 0)}</strong>
        </div>
        <div className="summary-chip">
          <span>Envelope</span>
          <strong>{formatAmount(envelope)}</strong>
        </div>
        <div className="summary-chip">
          <span>Current budgets</span>
          <strong>{formatAmount(recommendation.totalCurrent)}</strong>
        </div>
        {recommendation.feasible === false ? (
          <div className="summary-chip danger">
            <span>Floor deficit</span>
            <strong>{formatAmount(recommendation.deficit)}</strong>
          </div>
        ) : (
          <div className="summary-chip">
            <span>Recommended extra savings</span>
            <strong>{formatAmount(recommendation.extraSavings)}</strong>
          </div>
        )}
      </div>

      {recommendation.feasible === false && (
        <p className="inline-warning">
          Protected floors exceed the envelope by {formatAmount(recommendation.deficit)}. Lower the
          savings target or raise the income assumption in the plan.
        </p>
      )}

      {Array.isArray(recommendation.notes) && recommendation.notes.length > 0 && (
        <ul className="reco-notes">
          {recommendation.notes.map((note) => (
            <li key={note}>{formatText(note)}</li>
          ))}
        </ul>
      )}

      {privacyMode && (
        <p className="privacy-note">
          Amounts are hidden; recommended targets will be applied unchanged.
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setPrivacyMode(false)}
          >
            Show amounts to edit
          </button>
        </p>
      )}

      <div className="reco-list">
        {categories.map((item) => {
          const amount = Number(amounts[item.category] ?? item.target);
          const current = item.currentBudget === null ? 0 : Number(item.currentBudget);
          const delta = round2(amount - current);
          const lower = lowerBound(item);
          const upper = upperBound(item);
          const isSelected = Boolean(selected[item.category]);

          return (
            <article
              key={item.category}
              className={`reco-row ${isSelected ? 'selected' : ''}`}
            >
              <label className="reco-check">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) =>
                    setSelected((current2) => ({
                      ...current2,
                      [item.category]: event.target.checked,
                    }))
                  }
                  aria-label={`Include ${item.category} when applying budgets`}
                />
                <span className="check-box" aria-hidden="true" />
              </label>

              <div className="reco-main">
                <div className="reco-title-row">
                  <h4>{item.category}</h4>
                  <span className={`meta-chip ${item.essential ? 'chip-essential' : ''}`}>
                    {item.essential ? 'Essential' : 'Flexible'}
                  </span>
                  <span className={`confidence confidence-${item.confidence}`}>
                    {item.confidence} confidence
                  </span>
                  {item.currentBudget === null && <span className="meta-chip">new budget</span>}
                </div>

                <p className="reco-reason">{formatText(item.reason)}</p>

                {!privacyMode && (
                  <div className="range-row">
                    <span className="range-bound">{formatAmount(lower)}</span>
                    <input
                      type="range"
                      name={`reco-range-${item.category}`}
                      min={lower}
                      max={upper}
                      step="0.01"
                      value={Math.min(upper, Math.max(lower, amount))}
                      onChange={(event) => updateAmount(item, event.target.value)}
                      disabled={upper - lower < 1}
                      aria-label={`${item.category} proposed budget`}
                    />
                    <span className="range-bound">{formatAmount(upper)}</span>
                  </div>
                )}

                <div className="reco-meta">
                  <span>
                    Forecast {formatAmount(item.forecast.point)} ({formatAmount(item.forecast.low)} -{' '}
                    {formatAmount(item.forecast.high)})
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => onWhyCategory(item)}
                  >
                    Why this target
                  </button>
                </div>
              </div>

              <div className="reco-amount">
                <span className="reco-current">
                  {item.currentBudget === null
                    ? 'No budget'
                    : `Current ${formatAmount(item.currentBudget)}`}
                </span>
                {privacyMode ? (
                  <strong className="reco-amount-value">{formatAmount(amount)}</strong>
                ) : (
                  <>
                    <div className="amount-input">
                      <span aria-hidden="true">₹</span>
                      <input
                        type="number"
                        name={`reco-amount-${item.category}`}
                        min={lower}
                        max={upper}
                        step="0.01"
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => updateAmount(item, event.target.value)}
                        aria-label={`${item.category} budget amount`}
                      />
                    </div>
                    <span
                      className={`reco-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}
                    >
                      {delta === 0
                        ? 'no change'
                        : `${delta > 0 ? '+' : ''}${formatAmount(delta)}`}
                    </span>
                  </>
                )}
                {amount === 0 && item.currentBudget !== null && (
                  <span className="reco-remove-note">0 removes this budget</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {Array.isArray(recommendation.skipped) && recommendation.skipped.length > 0 && (
        <details className="raw-details">
          <summary>Categories without enough evidence to budget</summary>
          <ul className="proof-assumptions">
            {recommendation.skipped.map((item) => (
              <li key={item.category}>
                {item.category}: {formatText(item.reason)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="reco-footer">
        <div className="reco-totals">
          <div>
            <span>Plan total</span>
            <strong>{formatAmount(planTotal)}</strong>
          </div>
          <div>
            <span>Envelope</span>
            <strong>{formatAmount(envelope)}</strong>
          </div>
          <div>
            <span>{planRemaining >= 0 ? 'Unallocated' : 'Over envelope'}</span>
            <strong className={planRemaining < 0 ? 'negative' : 'positive'}>
              {formatAmount(Math.abs(planRemaining))}
            </strong>
          </div>
        </div>

        {planRemaining < 0 && (
          <p className="inline-warning">
            The edited plan is {formatAmount(Math.abs(planRemaining))} above the envelope. Applying it
            will save budgets that overspend your plan.
          </p>
        )}

        {applyWarnings.map((warning) => (
          <p key={warning} className="inline-warning">
            {formatText(warning)}
          </p>
        ))}

        {!canApply && (
          <p className="inline-warning">Switch to the current month to apply budgets.</p>
        )}

        <div className="reco-actions">
          <label className="select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>Select all</span>
          </label>
          <span className="selection-info">
            {entries.length} selected · {formatAmount(selectedTotal)}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canApply || applying || entries.length === 0}
            onClick={() => onApply(entries)}
          >
            {applying
              ? 'Applying...'
              : `Apply ${entries.length} change${entries.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </section>
  );
}
