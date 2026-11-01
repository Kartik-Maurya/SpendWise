import React from 'react';

export default function ChartDataTable({
  id,
  caption,
  columns,
  rows,
  emptyMessage = 'No data yet.',
  hidden = false,
}) {
  return (
    <div
      className="chart-table-wrap"
      id={id}
      role="region"
      aria-label={`${caption} data`}
      tabIndex={0}
      hidden={hidden}
    >
      <table className="chart-data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.align === 'right' ? 'num' : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="chart-data-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${id}-row-${index}`}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === 'right' ? 'num' : undefined}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
