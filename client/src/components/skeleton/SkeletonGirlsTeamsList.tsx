import Skeleton from './Skeleton';

interface SkeletonGirlsTeamsListProps {
  count?: number;
}

export default function SkeletonGirlsTeamsList({ count = 6 }: SkeletonGirlsTeamsListProps) {
  return (
    <div className="teams-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="team-card mb-3">
          <div className="d-flex align-items-stretch">
            <div className="px-3 align-self-center">
              <Skeleton width="1.25rem" height="1.25rem" />
            </div>
            <div className="team-header flex-grow-1 p-3 d-flex justify-content-between align-items-center">
              <Skeleton width={i % 2 === 0 ? '45%' : '38%'} height="1rem" />
              <Skeleton width="4.5rem" height="1.25rem" rounded />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
