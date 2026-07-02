import type { ExplorerFilters } from '../types';

const ALL_CATEGORIES = ['auth', 'registration', 'browse', 'player_zone', 'interaction'];

type Props = {
  filters: ExplorerFilters;
  onChange: (next: ExplorerFilters) => void;
  onRefresh: () => void;
};

export default function FilterBar({ filters, onChange, onRefresh }: Props) {
  return (
    <div className="filters-bar">
      <label>
        From
        <input
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={filters.to}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
        />
      </label>
      <label>
        Min edge sessions
        <input
          type="number"
          min={1}
          max={100}
          value={filters.minEdgeSessions}
          onChange={(e) =>
            onChange({ ...filters, minEdgeSessions: parseInt(e.target.value, 10) || 1 })
          }
        />
      </label>
      <label>
        Categories
        <select
          multiple
          value={filters.categories}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            onChange({ ...filters, categories: selected });
          }}
          style={{ minHeight: '4.5rem', minWidth: '10rem' }}
        >
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}
