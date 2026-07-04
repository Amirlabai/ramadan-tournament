import '../../pages/Stats.css';
import SkeletonDataTable from './SkeletonDataTable';

interface SkeletonGirlsHomeLayoutProps {
  rows?: number;
}

export default function SkeletonGirlsHomeLayout({ rows = 8 }: SkeletonGirlsHomeLayoutProps) {
  return (
    <div className="card standings-table" aria-hidden="true">
      <SkeletonDataTable rows={rows} columns={3} columnWidths={['2.5rem', '55%', '4rem']} />
    </div>
  );
}
