import '../../pages/Stats.css';
import '../../styles/tournament-worldcup.css';
import Skeleton from './Skeleton';
import SkeletonDataTable from './SkeletonDataTable';
import SkeletonScorersList from './SkeletonScorersList';
import SkeletonBracketPlaceholder from './SkeletonBracketPlaceholder';

interface SkeletonWcGroupGridProps {
  groupCount?: number;
  rowsPerGroup?: number;
  showBracket?: boolean;
}

export default function SkeletonWcGroupGrid({
  groupCount = 3,
  rowsPerGroup = 4,
  showBracket = true,
}: SkeletonWcGroupGridProps) {
  const groupColumns = ['2rem', '38%', '2rem', '3.5rem', '2rem', '2rem', '2.5rem', '2.5rem'];

  return (
    <>
      {showBracket && <SkeletonBracketPlaceholder />}
      <div className="wc-stats-layout" aria-hidden="true">
        <div className="wc-group-grid">
          {Array.from({ length: groupCount }, (_, i) => (
            <div key={i} className="card standings-table wc-group-card">
              <div className="skeleton-section-label skeleton-section-label--wc-group">
                <Skeleton width="3.5rem" height="1.05rem" />
              </div>
              <SkeletonDataTable
                rows={rowsPerGroup}
                columns={8}
                columnWidths={groupColumns}
              />
            </div>
          ))}
        </div>
        <SkeletonScorersList
          rows={5}
          panelClassName="wc-scorers-panel"
          titleWidth="6rem"
        />
      </div>
    </>
  );
}
