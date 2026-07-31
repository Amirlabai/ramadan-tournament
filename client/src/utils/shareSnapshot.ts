/**
 * Canonical JSON snapshots for share-image cache invalidation.
 * Two cards produce the same PNG iff their snapshots stringify equal.
 */

import { displayOrDash } from '@ramadan-tournament/shared';
import type { Match, Team, TopScorer } from '../types';

export type ShareSnapshot = Record<string, unknown>;

/** Deterministic JSON: sorted object keys, stable arrays, null for undefined. */
export function stringifyShareSnapshot(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = canonicalize(obj[key]);
  }
  return out;
}

export function buildShareCacheKey(snapshot: ShareSnapshot, prepared?: unknown): string {
  return stringifyShareSnapshot({
    snapshot,
    prepared: prepared ?? null,
  });
}

function logoOrNull(url: string | undefined, position?: Match['team1LogoPosition']) {
  return position === 'none' ? null : url ?? null;
}

function matchFaceSnapshot(match: Match) {
  return {
    id: match.id,
    date: match.date,
    location: match.location,
    phase: match.phase,
    team1Id: match.team1Id,
    team2Id: match.team2Id,
    team1Name: match.team1Name ?? null,
    team2Name: match.team2Name ?? null,
    team1LogoUrl: logoOrNull(match.team1LogoUrl, match.team1LogoPosition),
    team2LogoUrl: logoOrNull(match.team2LogoUrl, match.team2LogoPosition),
    score1: match.score1,
    score2: match.score2,
    technicalWinnerTeamId: match.technicalWinnerTeamId ?? null,
    goals: (match.goals ?? []).map((g) => ({
      memberId: g.memberId ?? null,
      minute: g.minute,
      isOwnGoal: !!g.isOwnGoal,
      creditedTeamId: g.creditedTeamId ?? null,
    })),
  };
}

/** Scorer faces used by MatchShareCard (names + head_photo). */
function scorerFacesSnapshot(match: Match, teams?: Team[]) {
  const counts = new Map<number, number>();
  for (const goal of match.goals ?? []) {
    if (goal.isOwnGoal || goal.memberId == null) continue;
    counts.set(goal.memberId, (counts.get(goal.memberId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([memberId, count]) => {
      let player: Team['players'][number] | undefined;
      for (const team of teams ?? []) {
        player = team.players?.find((p) => p.memberId === memberId);
        if (player) break;
      }
      return {
        memberId,
        count,
        nickname: player?.nickname ?? null,
        firstName: player?.firstName ?? null,
        lastName: player?.lastName ?? null,
        head_photo: player?.head_photo ?? null,
        isCaptain: player?.isCaptain ?? false,
        isTeamOwner: player?.isTeamOwner ?? false,
        squadRole: player?.squadRole ?? null,
        position: player?.position ?? '',
      };
    });
}

export function matchShareSnapshot(
  match: Match,
  status: string,
  extras?: {
    team1Logo?: string | null;
    team2Logo?: string | null;
    teams?: Team[];
  }
): ShareSnapshot {
  return {
    kind: 'match',
    status,
    team1Logo: extras?.team1Logo ?? null,
    team2Logo: extras?.team2Logo ?? null,
    match: matchFaceSnapshot(match),
    scorers: scorerFacesSnapshot(match, extras?.teams),
  };
}

type MatchListKind = 'upcoming-list' | 'recent-list' | 'playoff-list';

export function matchListShareSnapshot(
  kind: MatchListKind,
  matches: Match[],
  options?: { includeScores?: boolean; includeLocation?: boolean }
): ShareSnapshot {
  const includeScores =
    options?.includeScores ?? (kind === 'recent-list' || kind === 'playoff-list');
  const includeLocation = options?.includeLocation ?? kind === 'upcoming-list';
  return {
    kind,
    matches: matches.map((m) => ({
      id: m.id,
      date: m.date,
      phase: m.phase,
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      team1Name: m.team1Name ?? null,
      team2Name: m.team2Name ?? null,
      team1LogoUrl: logoOrNull(m.team1LogoUrl, m.team1LogoPosition),
      team2LogoUrl: logoOrNull(m.team2LogoUrl, m.team2LogoPosition),
      technicalWinnerTeamId: m.technicalWinnerTeamId ?? null,
      ...(includeLocation ? { location: m.location } : {}),
      ...(includeScores ? { score1: m.score1, score2: m.score2 } : {}),
    })),
  };
}

export function upcomingMatchesShareSnapshot(matches: Match[]): ShareSnapshot {
  return matchListShareSnapshot('upcoming-list', matches, {
    includeLocation: true,
    includeScores: false,
  });
}

export function recentMatchesShareSnapshot(matches: Match[]): ShareSnapshot {
  return matchListShareSnapshot('recent-list', matches, {
    includeLocation: false,
    includeScores: true,
  });
}

export function playoffMatchesShareSnapshot(matches: Match[]): ShareSnapshot {
  return matchListShareSnapshot('playoff-list', matches, {
    includeLocation: false,
    includeScores: true,
  });
}

export function topScorersShareSnapshot(scorers: TopScorer[], limit: number): ShareSnapshot {
  return {
    kind: 'top-scorers',
    limit,
    scorers: scorers.slice(0, limit).map((s) => ({
      memberId: s.memberId,
      playerName: s.playerName,
      teamId: s.teamId,
      teamName: s.teamName,
      goals: s.goals,
      head_photo: s.head_photo ?? null,
    })),
  };
}

export function teamShareSnapshot(team: Team, logoSrc?: string | null): ShareSnapshot {
  return {
    kind: 'team',
    id: team.id,
    name: team.name,
    description: team.description ?? null,
    logoSrc: logoSrc ?? null,
    logoUrl: logoOrNull(team.logoUrl, team.logoPosition),
    customLogoUrl: logoOrNull(team.customLogoUrl, team.logoPosition),
    players: (team.players ?? []).map((p) => ({
      memberId: p.memberId,
      number: p.number,
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      nickname: p.nickname ?? null,
      position: p.position,
      isCaptain: p.isCaptain,
      head_photo: p.head_photo ?? null,
    })),
  };
}

/** Safe Hebrew date for share cards — never throws on bad input. */
export function formatShareDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return displayOrDash(dateString);
  return new Intl.DateTimeFormat('he-IL', {
    ...options,
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}
