import '../../pages/Stats.css';
import Skeleton from './Skeleton';

interface SkeletonScorersListProps {
  rows?: number;
  panelClassName?: string;
  titleWidth?: string;
}

export default function SkeletonScorersList({
  rows = 5,
  panelClassName = '',
  titleWidth = '6rem',
}: SkeletonScorersListProps) {
  return (
    <div className={`card top-scorers-list ${panelClassName}`.trim()} aria-hidden="true">
      <div className="skeleton-section-label skeleton-section-label--scorers">
        <Skeleton width={titleWidth} height="1.25rem" />
      </div>
      <div className="scorers-list">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="scorer-item">
            <Skeleton width="2.5rem" height="1.5rem" />
            <div className="scorer-details skeleton-scorer-item__details">
              <Skeleton width={i === 0 ? '70%' : '55%'} height="1rem" className="mb-1" />
              <Skeleton width="40%" height="0.875rem" />
            </div>
            <div className="scorer-goals">
              <Skeleton width="2rem" height="1.5rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
