import { useCallback, useEffect, useState } from 'react';
import { displayOrDash } from '@ramadan-tournament/shared';
import { adminAPI } from '../../api/client';
import type { PointsStandingsEntry } from '../../types/girls';

interface GirlsSeason {
  id: string;
  yearMonth: string;
  displayName: string;
  isActive: boolean;
  teams: { id: number; name: string }[];
  _count?: { pointEntries: number };
}

interface PointEntryRow {
  id: string;
  points: number;
  note: string | null;
  recordedAt: string;
  team: { id: number; name: string };
  recordedBy?: { displayName: string } | null;
}

const GirlsSeasonAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<GirlsSeason | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [standings, setStandings] = useState<PointsStandingsEntry[]>([]);
  const [entries, setEntries] = useState<PointEntryRow[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [newYearMonth, setNewYearMonth] = useState('2026-02');
  const [newDisplayName, setNewDisplayName] = useState('טורניר בנות: נקודות 2026');
  const [newTeamName, setNewTeamName] = useState('');
  const [pointsTeamId, setPointsTeamId] = useState<number | ''>('');
  const [pointsDelta, setPointsDelta] = useState<number | ''>('');
  const [pointsNote, setPointsNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminAPI.getGirlsSeasonSummary();
      const s = res.data.season as GirlsSeason | null;
      setSeason(s);
      setActiveSeasonId(res.data.activeSeasonId);

      if (s?.id) {
        const [entriesRes] = await Promise.all([
          adminAPI.listPointEntries(s.id),
        ]);
        setEntries(entriesRes.data);
        if (s.isActive && s.id === res.data.activeSeasonId) {
          const standingsRes = await adminAPI.getGirlsStandings();
          setStandings(standingsRes.data);
        } else {
          setStandings([]);
        }
      } else {
        setEntries([]);
        setStandings([]);
      }
    } catch {
      setError('שגיאה בטעינת נתוני טורניר בנות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      await adminAPI.createGirlsSeason({
        yearMonth: newYearMonth,
        displayName: newDisplayName,
        activate: true,
      });
      setMessage('עונת בנות נוצרה והופעלה');
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'לא ניתן ליצור עונה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async () => {
    if (!season) return;
    setSubmitting(true);
    setError('');
    try {
      await adminAPI.activateSeason(season.id);
      setMessage('העונה הופעלה');
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'שגיאה בהפעלת עונה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!season || !newTeamName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await adminAPI.addGirlsTeam(season.id, newTeamName.trim());
      setNewTeamName('');
      setMessage('קבוצה נוספה');
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'שגיאה בהוספת קבוצה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!season || pointsTeamId === '' || pointsDelta === '') return;
    setSubmitting(true);
    setError('');
    try {
      const res = await adminAPI.createPointEntry({
        seasonId: season.id,
        teamId: Number(pointsTeamId),
        points: Number(pointsDelta),
        note: pointsNote.trim() || undefined,
      });
      setStandings(res.data.standings);
      setPointsNote('');
      setPointsDelta('');
      setMessage('נקודות נרשמו');
      const entriesRes = await adminAPI.listPointEntries(season.id);
      setEntries(entriesRes.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'שגיאה ברישום נקודות');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4" role="status">
        <span className="visually-hidden">טוען...</span>
        טוען...
      </div>
    );
  }

  return (
    <div className="girls-admin-panel">
      <p className="text-muted mb-3">
        ניהול טורניר בנות (נקודות). עונה נפרדת מכדורגל; הפעלה ידנית לפי PRD.
      </p>

      {message && (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!season && (
        <section className="card p-3 mb-4" aria-labelledby="create-girls-season-heading">
          <h3 id="create-girls-season-heading" className="h5 mb-3">
            יצירת עונת בנות
          </h3>
          <form onSubmit={handleCreateSeason} className="row g-3">
            <div className="col-md-4">
              <label htmlFor="girls-year-month" className="form-label">
                חודש-שנה (year_month)
              </label>
              <input
                id="girls-year-month"
                className="form-control"
                value={newYearMonth}
                onChange={(e) => setNewYearMonth(e.target.value)}
                pattern="\d{4}-\d{2}"
                required
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="girls-display-name" className="form-label">
                שם תצוגה
              </label>
              <input
                id="girls-display-name"
                className="form-control"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-success" disabled={submitting}>
                צור והפעל עונת בנות
              </button>
            </div>
          </form>
        </section>
      )}

      {season && (
        <>
          <section className="card p-3 mb-4" aria-labelledby="girls-season-status-heading">
            <h3 id="girls-season-status-heading" className="h5 mb-2">
              {season.displayName}
            </h3>
            <p className="mb-2">
              <span className="badge bg-secondary me-2">{season.yearMonth}</span>
              {season.isActive && season.id === activeSeasonId ? (
                <span className="badge bg-success">פעילה</span>
              ) : (
                <span className="badge bg-warning text-dark">לא פעילה</span>
              )}
              <span className="text-muted small ms-2">
                {season.teams.length} קבוצות · {season._count?.pointEntries ?? 0} רישומי נקודות
              </span>
            </p>
            {(!season.isActive || season.id !== activeSeasonId) && (
              <button
                type="button"
                className="btn btn-outline-success btn-sm"
                onClick={handleActivate}
                disabled={submitting}
              >
                הפעל עונה זו
              </button>
            )}
          </section>

          <div className="row g-4">
            <div className="col-lg-5">
              <section className="card p-3 h-100" aria-labelledby="add-team-heading">
                <h3 id="add-team-heading" className="h6 mb-3">
                  הוספת קבוצה
                </h3>
                <form onSubmit={handleAddTeam} className="d-flex gap-2">
                  <label htmlFor="new-team-name" className="visually-hidden">
                    שם קבוצה
                  </label>
                  <input
                    id="new-team-name"
                    className="form-control"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="שם קבוצה"
                    required
                  />
                  <button type="submit" className="btn btn-success" disabled={submitting}>
                    הוסף
                  </button>
                </form>

                <h3 className="h6 mt-4 mb-2">קבוצות</h3>
                {season.teams.length === 0 ? (
                  <p className="text-muted small mb-0">אין קבוצות עדיין</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {season.teams.map((t) => (
                      <li key={t.id} className="list-group-item px-0">
                        #{t.id}: {t.name}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="col-lg-7">
              <section className="card p-3 h-100" aria-labelledby="record-points-heading">
                <h3 id="record-points-heading" className="h6 mb-3">
                  רישום נקודות
                </h3>
                <form onSubmit={handleRecordPoints} className="row g-2">
                  <div className="col-md-5">
                    <label htmlFor="points-team" className="form-label">
                      קבוצה
                    </label>
                    <select
                      id="points-team"
                      className="form-select"
                      value={pointsTeamId}
                      onChange={(e) =>
                        setPointsTeamId(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      required
                    >
                      <option value="">בחרי קבוצה</option>
                      {season.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label htmlFor="points-delta" className="form-label">
                      נקודות (+ / −)
                    </label>
                    <input
                      id="points-delta"
                      type="number"
                      className="form-control"
                      value={pointsDelta}
                      onChange={(e) =>
                        setPointsDelta(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label htmlFor="points-note" className="form-label">
                      הערה (אופציונלי)
                    </label>
                    <input
                      id="points-note"
                      className="form-control"
                      value={pointsNote}
                      onChange={(e) => setPointsNote(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={submitting || season.teams.length === 0}
                    >
                      שמור נקודות
                    </button>
                  </div>
                </form>

                {standings.length > 0 && (
                  <>
                    <h4 className="h6 mt-4 mb-2">טבלת נקודות (פעילה)</h4>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <caption className="visually-hidden">דירוג נקודות בנות</caption>
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">קבוצה</th>
                            <th scope="col">נקודות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, i) => (
                            <tr key={row.teamId}>
                              <td>{i + 1}</td>
                              <td>{row.teamName}</td>
                              <td>
                                <strong>{row.totalPoints}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>

          <section className="card p-3 mt-4" aria-labelledby="recent-entries-heading">
            <h3 id="recent-entries-heading" className="h6 mb-3">
              רישומים אחרונים
            </h3>
            {entries.length === 0 ? (
              <p className="text-muted mb-0">אין רישומים</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <caption className="visually-hidden">היסטוריית נקודות</caption>
                  <thead>
                    <tr>
                      <th scope="col">תאריך</th>
                      <th scope="col">קבוצה</th>
                      <th scope="col">שינוי</th>
                      <th scope="col">הערה</th>
                      <th scope="col">מנהל</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <time dateTime={e.recordedAt}>
                            {new Date(e.recordedAt).toLocaleString('he-IL')}
                          </time>
                        </td>
                        <td>{e.team.name}</td>
                        <td>
                          <strong>{e.points > 0 ? `+${e.points}` : e.points}</strong>
                        </td>
                        <td>{displayOrDash(e.note)}</td>
                        <td>{displayOrDash(e.recordedBy?.displayName)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default GirlsSeasonAdmin;
