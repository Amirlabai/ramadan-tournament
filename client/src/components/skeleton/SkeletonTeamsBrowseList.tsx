import Skeleton from './Skeleton';

interface SkeletonTeamsBrowseListProps {
  count?: number;
  showVoteSlot?: boolean;
}

export default function SkeletonTeamsBrowseList({
  count = 6,
  showVoteSlot = false,
}: SkeletonTeamsBrowseListProps) {
  return (
    <div className="teams-browse-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="teams-browse-card">
          <div className={`teams-browse-header${showVoteSlot ? ' d-flex' : ''}`}>
            {showVoteSlot ? (
              <div className="px-2 align-self-center">
                <Skeleton width="1.25rem" height="1.25rem" />
              </div>
            ) : null}
            <Skeleton width="2.5rem" height="2.5rem" rounded />
            <div className="teams-browse-title flex-grow-1">
              <Skeleton width={i % 2 === 0 ? '42%' : '34%'} height="1rem" className="mb-1" />
              <Skeleton width="55%" height="0.75rem" />
            </div>
            <Skeleton width="2rem" height="2rem" rounded />
          </div>
        </article>
      ))}
    </div>
  );
}
