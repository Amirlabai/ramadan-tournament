import '../../pages/Dashboard.css';
import Skeleton from './Skeleton';

interface SkeletonUpcomingMatchItemsProps {
  count?: number;
}

export default function SkeletonUpcomingMatchItems({ count = 3 }: SkeletonUpcomingMatchItemsProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="upcoming-match-item">
          <div className="match-main-info">
            <Skeleton width="80%" height="1.1rem" className="team-right" />
            <Skeleton width="2.5rem" height="1.25rem" rounded className="match-vs" />
            <Skeleton width="80%" height="1.1rem" className="team-left" />
          </div>
          <div className="match-meta" style={{ textAlign: 'right', direction: 'rtl' }}>
            <Skeleton width="55%" height="0.875rem" className="mb-1" />
            <Skeleton width="40%" height="0.875rem" className="mb-1" />
            <Skeleton width="45%" height="0.875rem" />
          </div>
        </div>
      ))}
    </>
  );
}
