import React from 'react';

export default function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload || payload.length === 0) return null;

  const first = payload[0];
  const singleSlice = payload.length === 1 && Boolean(first?.payload?.name);
  const title = label ?? (singleSlice ? first.payload.name : null);

  return (
    <div className="chart-tooltip">
      {title && <div className="chart-tooltip-label">{title}</div>}
      <div className="chart-tooltip-items">
        {payload.map((item, index) => (
          <div className="chart-tooltip-row" key={`${item.dataKey ?? item.name}-${index}`}>
            <span
              className="chart-tooltip-dot"
              style={{ background: item.color || item.fill || 'var(--chart-1)' }}
            />
            <span className="chart-tooltip-name">
              {singleSlice ? 'Amount' : item.name ?? item.dataKey}
            </span>
            <span className="chart-tooltip-value">
              {formatValue ? formatValue(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
