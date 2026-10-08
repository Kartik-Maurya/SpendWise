import React from 'react';

export default function ChartCard({ title, children, className }) {
  return (
    <div className={`chart-card ${className || ''}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-content">{children}</div>
    </div>
  );
}
