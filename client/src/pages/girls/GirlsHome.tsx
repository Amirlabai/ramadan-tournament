import { useEffect, useState } from 'react';
import { statsGirlsAPI } from '../../api/client';
import SEO from '../../components/SEO';
import { GirlsHomeSkeleton } from '../../components/skeleton';
import { useMinSkeletonTime } from '../../hooks/useMinSkeletonTime';
import { useTournament } from '../../contexts/TournamentContext';
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
    <div className="stats-page container py-4">
      <SEO
        title="טורניר בנות — נקודות"
        description="טבלת נקודות לטורניר בנות רמדאן 2026. הקבוצה עם הכי הרבה נקודות מובילה."
        pathname="/girls"
      />
      <h2 className="mb-4 fw-bold tournament-page-title border-bottom pb-2">טבלת נקודות</h2>
      <div className="card standings-table">
        <div className="table-responsive">
          <table>
            <caption className="visually-hidden">דירוג קבוצות לפי סך נקודות</caption>
            <thead>
              <tr>
                <th scope="col">דירוג</th>
                <th scope="col">קבוצה</th>
                <th scope="col">נקודות</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => (
                <tr key={row.teamId}>
                  <td>{index + 1}</td>
                  <td className="team-name">{row.teamName}</td>
                  <td>
                    <strong>{row.totalPoints}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {standings.length === 0 && (
          <p className="text-center text-muted py-3 mb-0">אין קבוצות או נקודות עדיין</p>
        )}
      </div>
    </div>
  );
};

export default GirlsHome;
