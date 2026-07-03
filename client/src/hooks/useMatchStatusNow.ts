import { useEffect, useMemo, useRef, useState } from 'react';
import { needsMatchStatusClockTick } from '@ramadan-tournament/shared';

const STATUS_TICK_MS = 30_000;

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
    }, STATUS_TICK_MS);

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
