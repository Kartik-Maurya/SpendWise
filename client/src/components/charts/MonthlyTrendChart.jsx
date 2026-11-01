import React, { useId } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartTooltip from '../ChartTooltip.jsx';
import ChartLegend from '../ChartLegend.jsx';
import { formatCompactCurrency } from '../../utils/format.js';

export default function MonthlyTrendChart({
  data,
  height = 190,
  privacyMode = false,
  formatAmount,
}) {
  const gradientId = useId().replace(/:/g, '');
  const incomeFill = `income-fill-${gradientId}`;
  const expenseFill = `expense-fill-${gradientId}`;
  const tickFormatter = privacyMode ? () => '' : formatCompactCurrency;

  return (
    <>
      <div className="chart-plot" aria-hidden="true">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={data}
            margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <defs>
              <linearGradient id={incomeFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-income)" stopOpacity={0.17} />
                <stop offset="100%" stopColor="var(--chart-income)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={expenseFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-expense)" stopOpacity={0.17} />
                <stop offset="100%" stopColor="var(--chart-expense)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              cursor={{ stroke: 'var(--chart-cursor-line)', strokeWidth: 1 }}
              wrapperStyle={{ outline: 'none' }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="var(--chart-income)"
              fill={`url(#${incomeFill})`}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="var(--chart-expense)"
              fill={`url(#${expenseFill})`}
              strokeWidth={2}
            />
          </AreaChart>
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
