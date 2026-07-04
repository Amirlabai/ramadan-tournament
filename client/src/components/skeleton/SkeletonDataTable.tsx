import Skeleton from './Skeleton';

interface SkeletonDataTableProps {
  rows?: number;
  columns?: number;
  columnWidths?: string[];
}

export default function SkeletonDataTable({
  rows = 6,
  columns = 4,
  columnWidths,
}: SkeletonDataTableProps) {
  const widths =
    columnWidths ??
    Array.from({ length: columns }, (_, i) => {
      if (i === 0) return '2.5rem';
      if (i === columns - 1) return '3rem';
      return `${40 + (i % 3) * 15}%`;
    });

  return (
    <div className="table-responsive" aria-hidden="true">
      <table className="skeleton-data-table">
        <thead>
          <tr>
            {widths.map((width, col) => (
              <th key={col} scope="col">
                <Skeleton width={width} height="1rem" className="skeleton-data-table__cell" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {widths.map((width, col) => (
                <td key={col}>
                  <Skeleton width={width} height="1rem" className="skeleton-data-table__cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
