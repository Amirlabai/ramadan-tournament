import type { MutableRefObject } from 'react';
import {
  isTournamentPollingWindow,
  needsMatchStatusClockTick,
} from '@ramadan-tournament/shared';
import { matchesAPI } from '../api/client';

export function shouldRefreshPollMatches(matches: { date: string }[]): boolean {
  return isTournamentPollingWindow() || needsMatchStatusClockTick(matches);
}

export async function refreshPollMatchesRef(
  ref: MutableRefObject<{ date: string }[]>
): Promise<void> {
  try {
    const res = await matchesAPI.getAll();
    ref.current = res.data;
  } catch (err) {
    console.error('Failed to refresh match schedule for polling gate:', err);
  }
}
