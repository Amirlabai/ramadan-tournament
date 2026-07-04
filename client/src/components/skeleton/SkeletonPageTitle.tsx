import Skeleton from './Skeleton';

export default function SkeletonPageTitle() {
  return (
    <div className="skeleton-page-title" aria-hidden="true">
      <Skeleton width="14rem" height="1.75rem" className="skeleton-page-title__bar" />
    </div>
  );
}
