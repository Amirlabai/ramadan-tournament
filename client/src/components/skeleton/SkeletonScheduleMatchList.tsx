import '../../pages/Schedule.css';
import Skeleton from './Skeleton';

interface SkeletonScheduleMatchListProps {
  count?: number;
}

export default function SkeletonScheduleMatchList({ count = 4 }: SkeletonScheduleMatchListProps) {
  return (
    <div className="matches-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="match-card card upcoming">
          <span className="match-status upcoming">
            <Skeleton width="2.5rem" height="0.75rem" />
          </span>
          <div className="match-teams-score">
            <div className="team-side">
              <Skeleton width="70%" height="1rem" />
            </div>
            <div className="vs-divider">
              <Skeleton width="1.5rem" height="0.875rem" />
            </div>
            <div className="team-side">
              <Skeleton width="70%" height="1rem" />
            </div>
          </div>
          <div className="match-meta">
            <Skeleton width="8rem" height="0.875rem" />
            <Skeleton width="4rem" height="0.875rem" />
          </div>
        </div>
      ))}
    </div>
  );
}
