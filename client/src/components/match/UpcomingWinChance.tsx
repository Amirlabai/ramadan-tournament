import { useEffect, useRef, useState } from 'react';
import { matchStatsAPI, type MatchStatsSidePair } from '../../api/client';
import Skeleton from '../skeleton/Skeleton';
import { enqueueMatchStatsFetch } from '../../utils/matchStatsFetchQueue';
import { WinChanceBar } from './WinChanceBar';

type UpcomingWinChanceProps = {
  matchId: number;
  team1Name: string;
  team2Name: string;
};

const DEFAULT_CHANCE: MatchStatsSidePair = { a: 50, b: 50 };

export function UpcomingWinChance({ matchId, team1Name, team2Name }: UpcomingWinChanceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [chance, setChance] = useState<MatchStatsSidePair | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setChance(null);

    const load = async () => {
      try {
        const res = await enqueueMatchStatsFetch(() => matchStatsAPI.get(matchId));
        if (!cancelled) {
          setChance(res.data.winChance ?? DEFAULT_CHANCE);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setChance(null);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [matchId, inView]);

  const waiting = !inView || loading || (!failed && !chance);

  if (waiting) {
    return (
      <div
        ref={rootRef}
        className="match-winchance-card"
        role="status"
        aria-label="טוען הערכת יתרון"
      >
        <span className="visually-hidden">טוען הערכת יתרון…</span>
        <Skeleton height="0.65rem" width="5rem" className="match-winchance-card-skel-label" rounded />
        <Skeleton height="1.75rem" width="100%" className="match-winchance-card-skel-bar" rounded />
      </div>
    );
  }

  if (failed || !chance) {
    return (
      <div
        ref={rootRef}
        className="match-winchance-card match-winchance-card--unavailable"
        role="status"
      >
        <p className="match-stats-winchance-caption">הערכה לפי נתונים</p>
        <p className="match-stats-winchance-hint">לא זמינה כרגע</p>
      </div>
    );
  }

  return (
    <WinChanceBar
      chance={chance}
      team1Name={team1Name}
      team2Name={team2Name}
      className="match-winchance-card"
    />
  );
}
