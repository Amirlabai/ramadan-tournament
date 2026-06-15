import fs from 'fs';
import { readJsonFromFile } from '../utils/readJsonFile';
import path from 'path';
import { wcPlayerName, wcPosition, wcTeamName, wcVenue } from '../utils/worldCupLocale';

export interface FdTeamRef {
  id: number;
  name: string;
  crest?: string | null;
}

export interface FdGoal {
  minute: number;
  scorer?: { id: number; name: string } | null;
  team?: { id: number; name: string } | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  venue?: string | null;
  stage?: string | null;
  group?: string | null;
  homeTeam: FdTeamRef;
  awayTeam: FdTeamRef;
  score?: {
    fullTime?: { home: number | null; away: number | null };
  } | null;
  goals?: FdGoal[];
}

export interface NormalizedMatch {
  _id: string;
  id: number;
  date: string;
  location: string;
  phase: 'group' | 'knockout';
  team1Id: number;
  team2Id: number;
  score1: number | null;
  score2: number | null;
  team1Name: string;
  team2Name: string;
  team1LogoUrl?: string;
  team2LogoUrl?: string;
  goals: { memberId: number; minute: number; playerName?: string }[];
  status: string;
  stage?: string;
  group?: string;
  commentCount: number;
  createdAt: string;
}

export interface GroupStanding {
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  group: string;
}

export interface NormalizedTopScorer {
  memberId: number;
  playerName: string;
  teamName: string;
  teamId: number;
  goals: number;
}

export interface NormalizedTeam {
  _id: string;
  id: number;
  name: string;
  logoUrl?: string;
  logoPosition: 'right';
  players: {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    position: string;
    isCaptain: boolean;
  }[];
  createdAt: string;
}

const KNOCKOUT_STAGES = new Set([
  'LAST_16',
  'LAST_32',
  'LAST_64',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
  'PLAYOFFS',
  'PLAYOFF_ROUND_1',
  'PLAYOFF_ROUND_2',
]);

export function isKnockoutStage(stage?: string | null): boolean {
  if (!stage) return false;
  return KNOCKOUT_STAGES.has(stage) || (stage !== 'GROUP_STAGE' && stage.includes('FINAL'));
}

/** Knockout slot from API before teams are known (null/TBD) — hide from bracket UI */
export function isDisplayableKnockoutMatch(m: Pick<NormalizedMatch, 'phase' | 'team1Id' | 'team2Id' | 'team1Name' | 'team2Name'>): boolean {
  if (m.phase !== 'knockout') return false;
  if (m.team1Id == null || m.team2Id == null) return false;
  if (!m.team1Name?.trim() || !m.team2Name?.trim()) return false;
  return true;
}

export function filterDisplayableKnockoutMatches<T extends Pick<NormalizedMatch, 'phase' | 'team1Id' | 'team2Id' | 'team1Name' | 'team2Name'>>(matches: T[]): T[] {
  return matches.filter(isDisplayableKnockoutMatch);
}

export function normalizeMatch(raw: FdMatch): NormalizedMatch {
  const phase = raw.stage === 'GROUP_STAGE' ? 'group' : 'knockout';
  const score1 = raw.score?.fullTime?.home ?? null;
  const score2 = raw.score?.fullTime?.away ?? null;

  return {
    _id: `wc-${raw.id}`,
    id: raw.id,
    date: raw.utcDate,
    location: wcVenue(raw.venue) || '—',
    phase,
    team1Id: raw.homeTeam.id,
    team2Id: raw.awayTeam.id,
    score1,
    score2,
    team1Name: wcTeamName(raw.homeTeam.name, raw.homeTeam.id),
    team2Name: wcTeamName(raw.awayTeam.name, raw.awayTeam.id),
    team1LogoUrl: raw.homeTeam.crest || undefined,
    team2LogoUrl: raw.awayTeam.crest || undefined,
    goals: (raw.goals || [])
      .filter((g) => g.scorer?.id)
      .map((g) => ({
        memberId: g.scorer!.id,
        minute: g.minute,
        playerName: wcPlayerName(g.scorer!.name, g.scorer!.id),
      })),
    status: raw.status,
    stage: raw.stage || undefined,
    group: raw.group || undefined,
    commentCount: 0,
    createdAt: raw.utcDate,
  };
}

export function normalizeMatchesResponse(data: { matches?: FdMatch[] }): NormalizedMatch[] {
  return (data.matches || []).map(normalizeMatch);
}

export function buildTeamGroupMapFromMatches(matches: NormalizedMatch[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of matches) {
    if (m.phase !== 'group' && m.stage !== 'GROUP_STAGE') continue;
    const g = m.group;
    if (!g) continue;
    map.set(m.team1Id, g);
    map.set(m.team2Id, g);
  }
  return map;
}

function resolveWorldCupDataDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'data', 'worldcup'),
    path.join(process.cwd(), 'data', 'worldcup'),
    path.join(__dirname, '..', '..', '..', 'data', 'worldcup'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'team-groups.json'))) return dir;
    if (fs.existsSync(path.join(dir, 'matches.json'))) return dir;
  }
  return candidates[0];
}

/** Static team→group map (WC draw); fills gaps when match cache is partial */
export function loadTeamGroupFallback(): Map<number, string> {
  const map = new Map<number, string>();
  try {
    const filePath = path.join(resolveWorldCupDataDir(), 'team-groups.json');
    if (!fs.existsSync(filePath)) return map;
    const data = readJsonFromFile<{
      teamGroups?: Record<string, string>;
    }>(filePath);
    for (const [id, group] of Object.entries(data.teamGroups || {})) {
      map.set(Number(id), group);
    }
  } catch (err) {
    console.warn('WC team-groups.json load failed:', err);
  }
  return map;
}

/** Match-derived groups override static fallback */
export function buildCompleteTeamGroupMap(matches: NormalizedMatch[]): Map<number, string> {
  const merged = loadTeamGroupFallback();
  for (const [id, group] of buildTeamGroupMapFromMatches(matches)) {
    merged.set(id, group);
  }
  return merged;
}

export function normalizeStandingsResponse(
  data: {
  standings?: Array<{
    group?: string | null;
    stage?: string;
    type?: string;
    table?: Array<{
      team: { id: number; name: string };
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      points: number;
    }>;
  }>;
},
  teamGroupMap?: Map<number, string>
): GroupStanding[] {
  const result: GroupStanding[] = [];
  const seen = new Set<string>();

  for (const block of data.standings || []) {
    if (block.stage && block.stage !== 'GROUP_STAGE') continue;
    // FD returns TOTAL, HOME, and AWAY — keep overall table only
    if (block.type && block.type !== 'TOTAL') continue;

    for (const row of block.table || []) {
      const group = block.group || teamGroupMap?.get(row.team.id);
      if (!group) continue;

      const dedupeKey = `${group}:${row.team.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      result.push({
        teamId: row.team.id,
        teamName: wcTeamName(row.team.name, row.team.id),
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
        group,
      });
    }
  }
  return result.sort((a, b) => a.group.localeCompare(b.group) || b.points - a.points);
}

export function normalizeScorersResponse(data: {
  scorers?: Array<{
    player: { id: number; name: string };
    team: { id: number; name: string };
    goals: number;
  }>;
}): NormalizedTopScorer[] {
  return (data.scorers || []).map((s) => ({
    memberId: s.player.id,
    playerName: wcPlayerName(s.player.name, s.player.id),
    teamName: wcTeamName(s.team.name, s.team.id),
    teamId: s.team.id,
    goals: s.goals,
  }));
}

export function normalizeTeamsResponse(data: {
  teams?: Array<{
    id: number;
    name: string;
    crest?: string | null;
    squad?: Array<{
      id: number;
      name: string;
      position?: string | null;
      shirtNumber?: number | null;
    }>;
  }>;
}): NormalizedTeam[] {
  const now = new Date().toISOString();
  return (data.teams || []).map((t) => {
    const players = (t.squad || []).map((p) => {
      const displayName = wcPlayerName(p.name, p.id);
      const parts = displayName.split(' ');
      const firstName = parts[0] || displayName;
      const lastName = parts.slice(1).join(' ');
      return {
        memberId: p.id,
        firstName,
        lastName,
        nickname: displayName,
        number: p.shirtNumber ?? 0,
        position: wcPosition(p.position) || '—',
        isCaptain: false,
      };
    });
    return {
      _id: `wc-team-${t.id}`,
      id: t.id,
      name: wcTeamName(t.name, t.id),
      logoUrl: t.crest || undefined,
      logoPosition: 'right' as const,
      players,
      createdAt: now,
    };
  });
}

export function buildDashboard(
  matches: NormalizedMatch[],
  topScorers: NormalizedTopScorer[]
): {
  nextMatches: NormalizedMatch[];
  recentMatches: NormalizedMatch[];
  topScorers: NormalizedTopScorer[];
  playoffMatches: NormalizedMatch[];
} {
  const now = Date.now();
  const upcoming = matches
    .filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED' || (m.score1 == null && new Date(m.date).getTime() >= now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let nextMatches: NormalizedMatch[] = [];
  if (upcoming.length > 0) {
    const nextDate = new Date(upcoming[0].date);
    const nextDay = nextDate.toDateString();
    nextMatches = upcoming.filter((m) => new Date(m.date).toDateString() === nextDay);
  }

  const recentMatches = matches
    .filter((m) => m.status === 'FINISHED' || (m.score1 != null && m.score2 != null))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const playoffMatches = filterDisplayableKnockoutMatches(matches).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return {
    nextMatches,
    recentMatches,
    topScorers: topScorers.slice(0, 10),
    playoffMatches,
  };
}
