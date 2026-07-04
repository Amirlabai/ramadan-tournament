import Skeleton from './Skeleton';

interface SkeletonMatchCardsProps {
  count?: number;
}

export default function SkeletonMatchCards({ count = 3 }: SkeletonMatchCardsProps) {
  return (
    <div className="skeleton-match-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-match-card">
          <div className="skeleton-match-card__teams">
            <Skeleton width="35%" height="1.25rem" />
            <Skeleton width="2rem" height="1.25rem" />
            <Skeleton width="35%" height="1.25rem" />
          </div>
          <div className="skeleton-match-card__meta">
            <Skeleton width="5rem" height="0.875rem" />
            <Skeleton width="4rem" height="0.875rem" />
            <Skeleton width="6rem" height="0.875rem" />
          </div>
        </div>
      ))}
    </div>
  );
}
