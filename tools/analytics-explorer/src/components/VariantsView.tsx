import { useEffect, useState } from 'react';
import { fetchVariants } from '../api';
import type { ExplorerFilters, VariantRow } from '../types';
import { formatDuration } from '../utils/format';

type Props = {
  filters: ExplorerFilters;
  refreshKey: number;
};

export default function VariantsView({ filters, refreshKey }: Props) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchVariants(filters, 30)
      .then((res) => {
        if (!cancelled) setVariants(res.variants);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filters, refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;
  if (variants.length === 0) return <div className="loading">No variants in range.</div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Sequence</th>
          <th>Sessions</th>
          <th>Median duration</th>
        </tr>
      </thead>
      <tbody>
        {variants.map((v, i) => (
          <tr key={v.sequence.join('\0')}>
            <td>{i + 1}</td>
            <td>{v.sequence.join(' → ')}</td>
            <td>{v.sessionCount}</td>
            <td>{v.medianDurationMs > 0 ? formatDuration(v.medianDurationMs) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
