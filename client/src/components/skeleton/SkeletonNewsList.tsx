import Skeleton from './Skeleton';

interface SkeletonNewsListProps {
  count?: number;
}

export default function SkeletonNewsList({ count = 3 }: SkeletonNewsListProps) {
  return (
    <div className="skeleton-news-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-news-card">
          <Skeleton width="55%" height="1.25rem" className="mb-3" />
          <Skeleton width="100%" height="1rem" className="mb-2" />
          <Skeleton width="90%" height="1rem" className="mb-2" />
          <Skeleton width="6rem" height="0.875rem" />
        </div>
      ))}
    </div>
  );
}
