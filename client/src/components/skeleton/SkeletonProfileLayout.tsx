import Skeleton from './Skeleton';

export default function SkeletonProfileLayout() {
  return (
    <div aria-hidden="true">
      <div className="skeleton-profile-header">
        <Skeleton width="8rem" height="1.5rem" />
        <Skeleton width="12rem" height="1rem" />
      </div>
      <div className="skeleton-profile-avatar-row">
        <Skeleton width={80} height={80} circle />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Skeleton width="60%" height="1rem" />
          <Skeleton width="40%" height="1rem" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-card-block">
          <Skeleton width="40%" height="1.25rem" className="mb-3" />
          <Skeleton width="100%" height="1rem" className="mb-2" />
          <Skeleton width="85%" height="1rem" className="mb-2" />
          <Skeleton width="50%" height="2.25rem" rounded />
        </div>
      ))}
    </div>
  );
}
