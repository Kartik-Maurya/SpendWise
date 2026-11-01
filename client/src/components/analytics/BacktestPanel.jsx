import React from 'react';
import InfoHint from '../InfoHint.jsx';
import { usePrivacyFormat } from '../../contexts/PrivacyContext.jsx';

const VERDICT = {
  engine_lower_overrun: 'Engine produced less overrun than the proportional baseline.',
  engine_higher_overrun: 'Engine produced more overrun than the proportional baseline on this history.',
  tie: 'Engine tied the proportional baseline on overrun.',
};

function verdictTone(verdict) {
  if (verdict === 'engine_lower_overrun') return 'positive';
  if (verdict === 'engine_higher_overrun') return 'negative';
  return '';
}

export default function BacktestPanel({ backtest, onWhy }) {
  const { formatAmount, formatText } = usePrivacyFormat();

  if (!backtest) return null;

  const forecast = backtest.forecast || {};
  const rec = backtest.recommendations || {};
  const skill = forecast.skill;
  const skillText =
    skill === null || skill === undefined
      ? forecast.naiveMae === 0
        ? 'Baseline exact'
        : 'n/a'
      : `${Math.round(skill * 100)}%`;
  const skillTone = skill > 0 ? 'positive' : skill < 0 ? 'negative' : '';

  let skillNote = 'Not enough evaluated folds to score relative skill.';
  if (skill === null && forecast.naiveMae === 0) {
    skillNote =
      'The repeat-last-month baseline was already exact on this history, so relative skill is undefined rather than inflated.';
  } else if (skill > 0) {
    skillNote = 'The forecast beat the repeat-last-month baseline on this history.';
  } else if (skill < 0) {
    skillNote = 'On this history the forecast did worse than repeating last month, so treat projections with caution.';
  }

  const evaluatedRows = (rec.rows || []).filter((row) => row.status === 'evaluated');

  return (
    <section className="analysis-panel backtest-panel">
      <header className="panel-head">
        <h3>
          Can you trust this?
          <InfoHint label="How the backtest works">
            Each completed month is replayed using only the data that existed before it, then the
            forecast and the rebalancer are compared with simpler baselines.
          </InfoHint>
        </h3>
        {onWhy && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onWhy}>
            Why
          </button>
        )}
      </header>

      <div className="backtest-grid">
        <div className="backtest-block">
          <div className="block-head">
            <h4>Forecast accuracy</h4>
            <span className={`meta-chip ${forecast.status === 'available' ? 'chip-ready' : ''}`}>
              {forecast.status === 'available' ? 'Measured' : 'Locked'}
            </span>
          </div>

          {forecast.status === 'available' ? (
            <>
              <div className="metric-grid">
                <div className="metric">
                  <span>Folds</span>
                  <strong>{forecast.folds}</strong>
                </div>
                <div className="metric">
                  <span>Mean error</span>
                  <strong>{formatAmount(forecast.mae)}</strong>
                </div>
                <div className="metric">
                  <span>Error rate</span>
                  <strong>{forecast.mapePercent === null ? 'n/a' : `${forecast.mapePercent}%`}</strong>
                </div>
                <div className="metric">
                  <span>Repeat-last-month error</span>
                  <strong>{formatAmount(forecast.naiveMae)}</strong>
                </div>
                <div className="metric">
                  <span>Skill vs baseline</span>
                  <strong className={skillTone}>{skillText}</strong>
                </div>
              </div>
              <p className="block-note">{skillNote}</p>
              <details className="raw-details">
                <summary>Per-category accuracy</summary>
                <div className="table-scroll">
                  <table className="analytics-table compact">
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Folds</th>
                        <th scope="col">Error</th>
                        <th scope="col">Naive error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forecast.byCategory || []).map((row) => (
                        <tr key={row.category}>
                          <td>{row.category}</td>
                          <td>{row.folds}</td>
                          <td>{formatAmount(row.mae)}</td>
                          <td>{formatAmount(row.naiveMae)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="block-footnote">{formatText(forecast.assumption)}</p>
            </>
          ) : (
            <div className="panel-empty">
              <p>{formatText(forecast.reason)}</p>
              {Array.isArray(forecast.missing) && (
                <ul className="missing-list">
                  {forecast.missing.map((item) => (
                    <li key={item}>{formatText(item)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="backtest-block">
          <div className="block-head">
            <h4>Budget counterfactual</h4>
            <span className={`meta-chip ${rec.status === 'available' ? 'chip-ready' : ''}`}>
              {rec.status === 'available' ? 'Measured' : 'Locked'}
            </span>
          </div>

          {rec.status === 'available' ? (
            <>
              <p className={`verdict ${verdictTone(rec.verdict)}`}>
                {VERDICT[rec.verdict] || 'Comparison completed.'}
              </p>
              <div className="metric-grid">
                <div className="metric">
                  <span>Engine overrun</span>
                  <strong>{formatAmount(rec.totals.engineOverrun)}</strong>
                </div>
                <div className="metric">
                  <span>Proportional overrun</span>
                  <strong>{formatAmount(rec.totals.proportionalOverrun)}</strong>
                </div>
                <div className="metric">
                  <span>Repeat-budget overrun</span>
                  <strong>
                    {rec.totals.repeatOverrun === null
                      ? 'n/a'
                      : formatAmount(rec.totals.repeatOverrun)}
                  </strong>
                </div>
                <div className="metric">
                  <span>Months evaluated</span>
                  <strong>{rec.monthsEvaluated}</strong>
                </div>
              </div>
              <details className="raw-details">
                <summary>Month-by-month comparison</summary>
                <div className="table-scroll">
                  <table className="analytics-table compact">
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Actual</th>
                        <th scope="col">Envelope</th>
                        <th scope="col">Engine</th>
                        <th scope="col">Proportional</th>
                        <th scope="col">Repeat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluatedRows.map((row) => (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{formatAmount(row.actualTotal)}</td>
                          <td>{formatAmount(row.envelope)}</td>
                          <td>{formatAmount(row.engine.overrun)}</td>
                          <td>{formatAmount(row.proportional.overrun)}</td>
                          <td>{row.repeat === null ? 'n/a' : formatAmount(row.repeat.overrun)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {Array.isArray(rec.assumptions) && (
                <details className="raw-details">
                  <summary>Assumptions</summary>
                  <ul className="proof-assumptions">
                    {rec.assumptions.map((item) => (
                      <li key={item}>{formatText(item)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="panel-empty">
              <p>{formatText(rec.reason)}</p>
              {Array.isArray(rec.missing) && (
                <ul className="missing-list">
                  {rec.missing.map((item) => (
                    <li key={item}>{formatText(item)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
