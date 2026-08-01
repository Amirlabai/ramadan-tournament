import { useEffect, useMemo, useRef, useState } from 'react';
import {
  needsMatchStatusClockTick,
  TOURNAMENT_POLL_INTERVAL_MS,
} from '@ramadan-tournament/shared';

/** Re-render on a schedule when matches are near kickoff or full-time. */
export function useMatchStatusNow(matches: { date: string }[]) {
  const [now, setNow] = useState(() => new Date());
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const matchDatesKey = useMemo(
    () => matches.map((m) => m.date).join('|'),
    [matches]
  );

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (needsMatchStatusClockTick(matchesRef.current)) {
      setNow(new Date());
    }
  }, [matchDatesKey]);

  useEffect(() => {
    const tick = () => setNow(new Date());

    const id = setInterval(() => {
      if (needsMatchStatusClockTick(matchesRef.current)) {
        tick();
      }
    }, TOURNAMENT_POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return now;
}
