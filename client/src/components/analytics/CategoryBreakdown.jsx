import React from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

export default function CategoryBreakdown({ data }) {
  const { formatAmount } = usePrivacyFormat();
  const rows = Array.isArray(data) ? data : [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <section className="analysis-panel category-panel">
      <header className="panel-head">
        <h3>
          Where the money went
          <InfoHint label="About the category breakdown">
            Expenses recorded in the selected month, grouped by category. Shares use the visible
            category total.
          </InfoHint>
        </h3>
        {total > 0 && <span className="panel-count">{formatAmount(total)}</span>}
      </header>

      {rows.length === 0 ? (
        <div className="panel-empty">No expenses recorded for this month.</div>
      ) : (
        <ul className="category-list">
          {rows.map((row) => {
            const amount = Number(row.amount || 0);
            const share = total > 0 ? amount / total : 0;
            return (
              <li key={row.category} className="category-row">
                <div className="category-row-head">
                  <span className="category-name">{row.category}</span>
                  <span className="category-amount">{formatAmount(amount)}</span>
                  <span className="category-share">{Math.round(share * 100)}%</span>
                </div>
                <div className="category-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, share * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
