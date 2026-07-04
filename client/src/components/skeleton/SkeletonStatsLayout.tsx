import '../../pages/Stats.css';
import Skeleton from './Skeleton';
import SkeletonDataTable from './SkeletonDataTable';
import SkeletonScorersList from './SkeletonScorersList';
import SkeletonBracketPlaceholder from './SkeletonBracketPlaceholder';

const STANDINGS_COLUMNS = ['2.5rem', '28%', '3rem', '4.5rem', '2.5rem', '2.5rem', '2.5rem', '3rem'];

interface SkeletonStatsLayoutProps {
  showBracket?: boolean;
}

export default function SkeletonStatsLayout({ showBracket = true }: SkeletonStatsLayoutProps) {
  return (
    <>
      {showBracket && <SkeletonBracketPlaceholder />}
      <div className="stats-grid">
        <div className="card standings-table">
          <div className="skeleton-section-label skeleton-section-label--standings">
            <Skeleton width="5.5rem" height="1.25rem" />
          </div>
          <SkeletonDataTable rows={8} columns={8} columnWidths={STANDINGS_COLUMNS} />
        </div>
        <SkeletonScorersList rows={5} />
      </div>
    </>
  );
}
