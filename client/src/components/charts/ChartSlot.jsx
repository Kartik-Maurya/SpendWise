import React, { Suspense } from 'react';

export default function ChartSlot({ height, children }) {
  return (
    <Suspense
      fallback={
        <div
          className="chart-skeleton"
          style={{ height }}
          role="status"
        >
          <span className="sr-only">Loading chart…</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
