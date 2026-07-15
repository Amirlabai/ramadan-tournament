import { useEffect, useState } from 'react';
import { statsGirlsAPI } from '../../api/client';
import SEO from '../../components/SEO';
import { GirlsHomeSkeleton } from '../../components/skeleton';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';
import { useTournament } from '../../contexts/TournamentContext';
import StandingsTable from '../../components/standings/StandingsTable';
import '../Stats.css';

interface PointsStanding {
  teamId: number;
  teamName: string;
  logoUrl?: string;
  totalPoints: number;
}

const GirlsHome = () => {
  const { seasonLoading, seasonError } = useTournament();
  const [standings, setStandings] = useState<PointsStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await statsGirlsAPI.getStandings();
        setStandings(res.data);
        setError('');
      } catch {
        setError('שגיאה בטעינת טבלת הנקודות');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const showSkeleton = useMinSkeletonTime(seasonLoading || loading, {
    error: seasonError || error,
  });

  if (showSkeleton) {
    return <GirlsHomeSkeleton label="טוען טבלת נקודות..." />;
  }

  if (seasonError || error) {
    return (
      <div className="container py-4" role="alert">
        <p className="text-muted text-center">{seasonError || error}</p>
      </div>
    );
  }

  return (
    <div className="stats-page browse-page container py-4">
      <SEO
        title="טורניר בנות — נקודות"
        description="טבלת נקודות לטורניר בנות רמדאן 2026. הקבוצה עם הכי הרבה נקודות מובילה."
        pathname="/girls"
      />
      <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">טבלת נקודות</h2>
      <StandingsTable
        caption="דירוג קבוצות לפי סך נקודות"
        captionClassName="visually-hidden"
        columns={[
          {
            id: 'rank',
            header: 'דירוג',
            render: (_row, index) => index + 1,
          },
          {
            id: 'team',
            header: 'קבוצה',
            className: 'team-name',
            render: (row) => row.teamName,
          },
          {
            id: 'points',
            header: 'נקודות',
            render: (row) => <strong>{row.totalPoints}</strong>,
          },
        ]}
        rows={standings}
        getRowKey={(row) => row.teamId}
        emptyMessage="אין קבוצות או נקודות עדיין"
      />
    </div>
  );
};

export default GirlsHome;
