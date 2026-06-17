import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'No records.',
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  const align = { left: 'text-left', right: 'text-right', center: 'text-center' };

  // No data — show only the empty state, not an orphaned header row.
  if (rows.length === 0) {
    return <div className="px-3 py-8 text-center text-muted">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted ${align[c.align ?? 'left']}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border/60 ${
                  onRowClick ? 'cursor-pointer hover:bg-surface-2' : ''
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2.5 ${align[c.align ?? 'left']} ${c.className ?? ''}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
