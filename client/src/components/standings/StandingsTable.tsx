import type { ReactNode } from 'react';
import './StandingsTable.css';

export interface StandingsColumn<T> {
  id: string;
  header: string;
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface StandingsTableProps<T> {
  title?: string;
  caption: string;
  captionClassName?: string;
  columns: StandingsColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  getRowClassName?: (row: T, index: number) => string | undefined;
  emptyMessage?: string;
}

export default function StandingsTable<T>({
  title,
  caption,
  captionClassName = 'stats-standings-caption',
  columns,
  rows,
  getRowKey,
  getRowClassName,
  emptyMessage,
}: StandingsTableProps<T>) {
  return (
    <div className="card standings-table">
      {title ? <h2 className="standings-table__title">{title}</h2> : null}
      <div className="table-responsive">
        <table className="standings-table__table">
          <caption className={captionClassName}>{caption}</caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} scope="col" className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={getRowKey(row)}
                className={getRowClassName?.(row, index)}
              >
                {columns.map((col) => (
                  <td key={col.id} className={col.className}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && emptyMessage ? (
        <p className="standings-table__empty text-center text-muted py-3 mb-0" role="status">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}
