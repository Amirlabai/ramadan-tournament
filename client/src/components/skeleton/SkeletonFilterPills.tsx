import Skeleton from './Skeleton';

interface SkeletonFilterPillsProps {
  count?: number;
}

export default function SkeletonFilterPills({ count = 4 }: SkeletonFilterPillsProps) {
  return (
    <div className="skeleton-filter-pills" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width="4.5rem" height="2.25rem" rounded className="skeleton-filter-pill" />
      ))}
    </div>
  );
}
