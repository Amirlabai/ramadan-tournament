import '../../styles/filter-bar.css';
import Skeleton from './Skeleton';

const FILTER_WIDTHS = ['3rem', '3.5rem', '3.5rem', '4rem'];

export default function SkeletonScheduleFilters() {
  return (
    <div className="schedule-filters" aria-hidden="true">
      {FILTER_WIDTHS.map((width, i) => (
        <span key={i} className="filter-btn skeleton-filter-btn" aria-hidden="true">
          <Skeleton width={width} height="0.85rem" />
          {i > 0 && (
            <span className="filter-count">
              <Skeleton width="1.25rem" height="0.75rem" />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
