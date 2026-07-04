import '../../pages/Dashboard.css';
import Skeleton from './Skeleton';

interface SkeletonRecentMatchItemsProps {
  count?: number;
}

export default function SkeletonRecentMatchItems({ count = 3 }: SkeletonRecentMatchItemsProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="match-item">
          <Skeleton width="45%" height="0.85rem" className="match-date" />
          <div className="match-score">
            <Skeleton width="85%" height="1rem" className="team-home" />
            <Skeleton width="3.5rem" height="1.25rem" rounded className="score" />
            <Skeleton width="85%" height="1rem" className="team-away" />
          </div>
        </div>
      ))}
    </>
  );
}
