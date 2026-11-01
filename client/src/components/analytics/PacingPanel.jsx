import React from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

const STATUS_LABEL = {
  exceeded: 'Over budget',
  at_risk: 'At risk',
  underspending: 'Room to redirect',
  on_track: 'On track',
  unbudgeted: 'No budget',
};

export default function PacingPanel({ pacing, onWhy }) {
  const { formatAmount } = usePrivacyFormat();

  if (!pacing) return null;

  const rows = (pacing.rows || []).filter(
    (row) => Number(row.spent) > 0 || (row.budget !== null && Number(row.budget) > 0)
  );
  const totals = pacing.totals || {};

  return (
    <section className="analysis-panel pacing-panel">
      <header className="panel-head">
        <h3>
          How the month is tracking
          <InfoHint label="How pacing is projected">
            Projection adds your median daily pace for the remaining days to what you have already
            spent this month. Categories with no spending and no budget are hidden.
          </InfoHint>
        </h3>
      </header>

      {rows.length > 0 && (
        <div className="summary-chips">
          <div className="summary-chip">
            <span>Budgeted</span>
            <strong>{formatAmount(totals.budgetTotal || 0)}</strong>
          </div>
          <div className="summary-chip">
            <span>Spent</span>
            <strong>{formatAmount(totals.spentTotal || 0)}</strong>
          </div>
          <div className="summary-chip">
            <span>Projected</span>
            <strong>{formatAmount(totals.projectedTotal || 0)}</strong>
          </div>
          <div className="summary-chip">
            <span>Over now</span>
            <strong className={totals.overspendNow > 0 ? 'negative' : ''}>
              {formatAmount(totals.overspendNow || 0)}
            </strong>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="panel-empty">No spending or budgets to pace for this month.</div>
      ) : (
        <div className="table-scroll">
          <table className="analytics-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Spent / budget</th>
                <th scope="col">Projected</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const percent = row.budget
                  ? Math.min(100, Math.max(0, (row.spent / row.budget) * 100))
                  : 0;
                return (
                  <tr key={row.category}>
                    <td className="cell-category">{row.category}</td>
                    <td>
                      <div className="cell-amount">
                        {formatAmount(row.spent)}
                        <span className="muted">
                          {' / '}
                          {row.budget === null ? 'no budget' : formatAmount(row.budget)}
                        </span>
                      </div>
                      {row.budget !== null && (
                        <div className={`mini-progress status-${row.status}`}>
                          <span style={{ width: `${percent}%` }} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="cell-amount">{formatAmount(row.projected)}</div>
                      {row.variance !== null && (
                        <span className={`cell-sub ${row.variance > 0 ? 'negative' : 'positive'}`}>
                          {row.variance > 0 ? 'over by ' : 'under by '}
                          {formatAmount(Math.abs(row.variance))}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-chip status-${row.status}`}>
                        {STATUS_LABEL[row.status] || row.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => onWhy(row)}
                      >
                        Why
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
