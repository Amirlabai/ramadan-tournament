import '../../styles/tournament-worldcup.css';
import Skeleton from './Skeleton';

interface SkeletonWcTeamsListProps {
  count?: number;
}

export default function SkeletonWcTeamsList({ count = 8 }: SkeletonWcTeamsListProps) {
  return (
    <div className="wc-teams-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="wc-team-card card">
          <div className="skeleton-wc-team-header">
            <Skeleton width={40} height={40} circle />
            <div className="skeleton-wc-team-header__text">
              <Skeleton width={i % 2 === 0 ? '55%' : '48%'} height="1rem" className="mb-1" />
              <Skeleton width="35%" height="0.875rem" />
            </div>
            <Skeleton width="0.875rem" height="0.875rem" />
          </div>
        </article>
      ))}
    </div>
  );
}
