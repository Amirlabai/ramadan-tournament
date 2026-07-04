import '../PlayoffBracket.css';
import Skeleton from './Skeleton';

interface SkeletonBracketPlaceholderProps {
  className?: string;
}

export default function SkeletonBracketPlaceholder({
  className = 'mb-4',
}: SkeletonBracketPlaceholderProps) {
  return (
    <div className={`card playoff-bracket-card ${className}`.trim()} aria-hidden="true">
      <div className="skeleton-section-label mb-3">
        <Skeleton width="6rem" height="1.5rem" />
      </div>
      <div className="brackets-wrapper">
        {[0, 1].map((i) => (
          <div key={i} className="bracket">
            <Skeleton width="5rem" height="1.2rem" className="mb-3 mx-auto" />
            <div className="bracket-content">
              {[0, 1, 2].map((j) => (
                <div key={j} className="bracket-match mb-2">
                  <Skeleton width="100%" height="2.5rem" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
