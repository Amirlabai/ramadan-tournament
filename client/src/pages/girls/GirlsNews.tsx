import { useEffect, useState } from 'react';
import { newsAPI } from '../../api/client';
import SEO from '../../components/SEO';
import { useTournament } from '../../contexts/TournamentContext';
import type { News } from '../../types';

const GirlsNews = () => {
  const { seasonLoading, seasonError } = useTournament();
  const [items, setItems] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await newsAPI.getAll('girls');
        setItems(res.data);
        setError('');
      } catch {
        setError('שגיאה בטעינת חדשות');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (seasonLoading || loading) {
    return (
      <div className="loading" role="status">
        <span className="visually-hidden">טוען...</span>
        טוען...
      </div>
    );
  }

  if (seasonError || error) {
    return (
      <div className="container py-4" role="alert">
        <p className="text-muted text-center">{seasonError || error}</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <SEO
        title="חדשות — טורניר בנות"
        description="עדכונים וחדשות לטורניר בנות רמדאן 2026."
        url="https://ramadan-tournament-client.vercel.app/news-girls"
      />
      <h2 className="mb-4 fw-bold text-success border-bottom pb-2">חדשות</h2>
      {items.length === 0 ? (
        <p className="text-muted">אין עדכונים כרגע</p>
      ) : (
        <ul className="list-unstyled">
          {items.map((item) => (
            <li key={item.id} className="card mb-3 p-3 shadow-sm">
              <h3 className="h5 mb-2">{item.title}</h3>
              <p className="mb-2">{item.message}</p>
              <time className="text-muted small" dateTime={item.date}>
                {new Date(item.date).toLocaleDateString('he-IL')}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GirlsNews;
