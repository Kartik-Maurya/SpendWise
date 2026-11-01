import React from 'react';

export default function ChartLegend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.name}>
          <span className="chart-legend-dot" style={{ background: item.color }} />
          <span className="chart-legend-name">{item.name}</span>
          {item.value !== undefined && item.value !== null && (
            <span className="chart-legend-value">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
