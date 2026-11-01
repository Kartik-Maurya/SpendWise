import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartTooltip from '../ChartTooltip.jsx';
import ChartLegend from '../ChartLegend.jsx';
import { formatCompactCurrency } from '../../utils/format.js';

export default function IncomeExpenseBars({
  data,
  height = 190,
  privacyMode = false,
  formatAmount,
  maxBarSize = 44,
}) {
  const tickFormatter = privacyMode ? () => '' : formatCompactCurrency;

  return (
    <>
      <div className="chart-plot" aria-hidden="true">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="month"
              minTickGap={18}
              tickMargin={6}
              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={{ stroke: 'var(--chart-grid)' }}
            />
            <YAxis
              width={58}
              tickMargin={4}
              tickFormatter={tickFormatter}
              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={{ stroke: 'var(--chart-grid)' }}
            />
            <Tooltip
              content={<ChartTooltip formatValue={formatAmount} />}
              cursor={{ fill: 'var(--chart-cursor)' }}
              wrapperStyle={{ outline: 'none' }}
            />
            <Bar
              dataKey="income"
              name="Income"
              fill="var(--chart-income)"
              radius={[3, 3, 0, 0]}
              maxBarSize={maxBarSize}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill="var(--chart-expense)"
              radius={[3, 3, 0, 0]}
              maxBarSize={maxBarSize}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { name: 'Income', color: 'var(--chart-income)' },
          { name: 'Expenses', color: 'var(--chart-expense)' },
        ]}
      />
    </>
  );
}
