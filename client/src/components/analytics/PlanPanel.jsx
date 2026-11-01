import React, { useEffect, useState } from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacy, usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

const OBJECTIVE_LABEL = {
  savings: 'Save more',
  overrun: 'Avoid overruns',
};

export default function PlanPanel({ plan, onSave, saving }) {
  const { formatAmount } = usePrivacyFormat();
  const { privacyMode, setPrivacyMode } = usePrivacy();
  const [income, setIncome] = useState('');
  const [savings, setSavings] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setIncome(plan?.income_assumption ?? '');
    setSavings(plan?.savings_target ?? '');
    setError('');
  }, [plan]);

  const numericIncome = income === '' ? null : Number(income);
  const numericSavings = savings === '' ? null : Number(savings);
  const envelope =
    numericIncome !== null && Number.isFinite(numericIncome)
      ? Math.max(0, numericIncome - (Number.isFinite(numericSavings) ? numericSavings || 0 : 0))
      : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (numericIncome !== null && (!Number.isFinite(numericIncome) || numericIncome < 0)) {
      setError('Income assumption must be a non-negative number.');
      return;
    }
    if (numericSavings !== null && (!Number.isFinite(numericSavings) || numericSavings < 0)) {
      setError('Savings target must be a non-negative number.');
      return;
    }

    onSave({
      income_assumption: numericIncome,
      savings_target: numericSavings ?? 0,
      objective: plan?.objective || 'savings',
    });
  };

  return (
    <section className="analysis-panel plan-panel" id="plan-panel">
      <header className="panel-head">
        <h3>
          Monthly plan
          <InfoHint label="About the monthly plan">
            The plan sets the envelope: income assumption minus the savings target. Leave income
            blank to estimate it from months with recorded income. These are assumptions, not
            measurements.
          </InfoHint>
        </h3>
        {plan?.objective && (
          <span className="meta-chip">{OBJECTIVE_LABEL[plan.objective] || plan.objective}</span>
        )}
      </header>

      {privacyMode ? (
        <div className="privacy-note">
          Amounts are hidden while privacy mode is on.
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setPrivacyMode(false)}
          >
            Show amounts to edit the plan
          </button>
        </div>
      ) : (
        <form className="plan-form" onSubmit={handleSubmit}>
          <div className="plan-field">
            <label htmlFor="plan-income">Income assumption</label>
            <input
              id="plan-income"
              name="plan-income"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Use recorded income"
              value={income}
              onChange={(event) => setIncome(event.target.value)}
            />
            <span className="field-hint">Leave blank to estimate from recorded income.</span>
          </div>
          <div className="plan-field">
            <label htmlFor="plan-savings">Savings target</label>
            <input
              id="plan-savings"
              name="plan-savings"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0"
              value={savings}
              onChange={(event) => setSavings(event.target.value)}
            />
            <span className="field-hint">The amount you want left after spending.</span>
          </div>

          <div className="plan-envelope">
            <span>Envelope for spending</span>
            <strong>{envelope === null ? 'Set income to preview' : formatAmount(envelope)}</strong>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
            {saving ? 'Saving plan...' : 'Save plan'}
          </button>
        </form>
      )}
    </section>
  );
}
