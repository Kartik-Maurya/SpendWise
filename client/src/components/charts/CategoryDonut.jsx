import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import ChartTooltip from '../ChartTooltip.jsx';
import ChartLegend from '../ChartLegend.jsx';

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
];

export default function CategoryDonut({
  data,
  height = 160,
  detailed = false,
  formatAmount,
}) {
  const legend = data.map((slice, index) => ({
    name: slice.name,
    color: CHART_COLORS[index % CHART_COLORS.length],
    value: detailed
      ? `${slice.percent}% · ${formatAmount(slice.value)}`
      : `${slice.percent}%`,
  }));

  return (
    <>
      <div className="chart-plot" aria-hidden="true">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 0, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={detailed ? 78 : 46}
              outerRadius={detailed ? 126 : 72}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={<ChartTooltip formatValue={formatAmount} />}
              wrapperStyle={{ outline: 'none' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={legend} />
    </>
  );
}
