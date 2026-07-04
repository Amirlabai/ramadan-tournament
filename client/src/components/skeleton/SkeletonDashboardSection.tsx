import '../../pages/Dashboard.css';
import Skeleton from './Skeleton';
import SkeletonUpcomingMatchItems from './SkeletonUpcomingMatchItems';
import SkeletonRecentMatchItems from './SkeletonRecentMatchItems';

interface SkeletonDashboardSectionProps {
  variant?: 'next' | 'recent';
  titleWidth?: string;
  count?: number;
}

export default function SkeletonDashboardSection({
  variant = 'next',
  titleWidth = '7rem',
  count = 3,
}: SkeletonDashboardSectionProps) {
  const cardClass = variant === 'next' ? 'next-matches-card' : 'recent-matches';

  return (
    <div className={`dashboard-card skeleton-dashboard-card ${cardClass}`} aria-hidden="true">
      <div className="dashboard-card-title">
        <Skeleton width={titleWidth} height="1.25rem" />
      </div>
      {variant === 'next' ? (
        <div className="next-matches-list">
          <SkeletonUpcomingMatchItems count={count} />
        </div>
      ) : (
        <div className="matches-list">
          <SkeletonRecentMatchItems count={count} />
        </div>
      )}
    </div>
  );
}
