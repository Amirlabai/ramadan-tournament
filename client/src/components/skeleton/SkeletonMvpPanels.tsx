import '../../pages/Dashboard.css';
import Skeleton from './Skeleton';

export default function SkeletonMvpPanels() {
  return (
    <div className="dashboard-cards-row" aria-hidden="true">
      <div className="dashboard-card top-scorer mt-0">
        <div className="dashboard-card-title">
          <Skeleton width="5.5rem" height="1.25rem" />
        </div>
        <div className="scorer-info">
            <div className="skeleton-premium-scorer">
              <Skeleton width="2.5rem" height="2.5rem" circle />
              <Skeleton width="65%" height="1.5rem" />
              <Skeleton width="45%" height="1rem" />
              <Skeleton width="3rem" height="2rem" />
              <Skeleton width="3.5rem" height="0.875rem" />
            </div>
            <div className="runners-up-list">
              {[0, 1].map((i) => (
                <div key={i} className="runner-up-item d-flex align-items-center gap-2 py-2">
                  <Skeleton width="1.25rem" height="1rem" />
                  <Skeleton width="40%" height="1rem" />
                  <Skeleton width="25%" height="0.875rem" />
                  <Skeleton width="1.5rem" height="1rem" className="ms-auto" />
                </div>
              ))}
            </div>
          </div>
      </div>
      <div className="dashboard-card mvp-race-card mt-0">
        <div className="dashboard-card-title">
          <Skeleton width="4rem" height="1.25rem" />
        </div>
        <div className="mvp-race-list">
          {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton-mvp-row">
                <div className="skeleton-mvp-row__main">
                  <Skeleton width="1.75rem" height={i === 0 ? '1.75rem' : '1.25rem'} />
                  <div className="skeleton-mvp-row__info">
                    <Skeleton width={i === 0 ? '75%' : '60%'} height="1rem" className="mb-1" />
                    <Skeleton width="45%" height="0.875rem" />
                  </div>
                </div>
                <div className="text-center">
                  <Skeleton width="2rem" height="1.25rem" />
                  <Skeleton width="2.5rem" height="0.75rem" className="mt-1" />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
