import Skeleton from './Skeleton';
import SkeletonDataTable from './SkeletonDataTable';

export default function SkeletonArchiveLayout() {
  return (
    <div aria-hidden="true">
      <div className="skeleton-archive-tabs">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="5.5rem" height="2.5rem" />
        ))}
      </div>
      <div className="skeleton-card-block">
        <Skeleton width="50%" height="1.5rem" className="mb-3" />
        <div className="d-flex gap-3 mb-3">
          <Skeleton width={64} height={64} circle />
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height="1rem" className="mb-2" />
            <Skeleton width="45%" height="1rem" />
          </div>
        </div>
      </div>
      <Skeleton width="30%" height="1.25rem" className="mb-3" />
      <SkeletonDataTable rows={6} columns={3} columnWidths={['2rem', '60%', '3rem']} />
    </div>
  );
}
