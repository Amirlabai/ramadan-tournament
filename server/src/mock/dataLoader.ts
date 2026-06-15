import * as fs from 'fs';
import * as path from 'path';

export const MOCK_SEASON_ID = 'mock-dev-boys-season';

export interface MockPlayer {
  memberId: number;
  firstName: string;
  lastName: string;
  nickname: string;
  number: number;
  position: string;
  isCaptain: boolean;
  head_photo: string;
  bio: string;
}

export interface MockTeam {
  id: number;
  name: string;
  logoUrl: string;
  logoPosition: string;
  players: MockPlayer[];
}

export interface MockGoal {
  memberId: number;
  minute: number | null;
}

export interface MockMatch {
  id: number;
  date: Date;
  location: string;
  phase: string;
  team1Id: number;
  team2Id: number;
  score1: number | null;
  score2: number | null;
  goals: MockGoal[];
}

export interface MockNews {
  id: number;
  title: string;
  message: string;
  date: Date;
  priority: string;
  seasonId: string;
}

function resolveDataDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'data'),
    path.join(process.cwd(), 'data'),
    path.join(__dirname, '..', '..', '..', 'data'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'teams.json'))) return dir;
  }
  throw new Error('Mock dev: could not find data/teams.json (run server from repo with data/ present)');
}

function parseJerusalemDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+02:00`);
}

function loadTeams(dataDir: string): MockTeam[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf-8')) as any[];
  return raw.map((team) => ({
    id: team.id,
    name: team.name,
    logoUrl: team.logo || '',
    logoPosition: 'right',
    players: (team.members || []).map((member: any) => {
      const nameParts = (member.name || '').split(' ');
      const firstName = nameParts[0] || member.nickname || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      return {
        memberId: member.id,
        firstName,
        lastName,
        nickname: member.nickname || '',
        number: member.number,
        position: member.position || '',
        isCaptain: member.is_captain || false,
        head_photo: member.head_photo || '',
        bio: member.bio || '',
      };
    }),
  }));
}

function loadMatches(dataDir: string): MockMatch[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'matches.json'), 'utf-8')) as any[];
  return raw.map((match) => ({
    id: match.id,
    date: parseJerusalemDate(match.date),
    location: match.location,
    phase: match.phase || 'group',
    team1Id: match.team1_id,
    team2Id: match.team2_id,
    score1: match.score1,
    score2: match.score2,
    goals: (match.goals || []).map((g: any) => ({
      memberId: g.member_id ?? g.memberId,
      minute: g.minute ?? null,
    })),
  }));
}

function loadNews(dataDir: string): MockNews[] {
  const file = path.join(dataDir, 'news.json');
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as any[];
  return raw.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    date: parseJerusalemDate(item.date),
    priority: item.priority || 'normal',
    seasonId: MOCK_SEASON_ID,
  }));
}

let cache: {
  teams: MockTeam[];
  matches: MockMatch[];
  news: MockNews[];
} | null = null;

export function getMockStore() {
  if (!cache) {
    const dataDir = resolveDataDir();
    cache = {
      teams: loadTeams(dataDir),
      matches: loadMatches(dataDir),
      news: loadNews(dataDir),
    };
    console.log(
      `Mock dev data loaded from ${dataDir}: ${cache.teams.length} teams, ${cache.matches.length} matches, ${cache.news.length} news`
    );
  }
  return cache;
}

export function formatTeamForApi(team: MockTeam, statsMap: Map<number, { goals: number; gamesPlayed: number }>) {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    logoPosition: team.logoPosition,
    players: team.players.map((p) => {
      const stats = statsMap.get(p.memberId);
      return {
        memberId: p.memberId,
        firstName: p.firstName,
        lastName: p.lastName,
        nickname: p.nickname,
        number: p.number,
        position: p.position,
        isCaptain: p.isCaptain,
        squadRole: null,
        lineup: 'bench',
        head_photo: p.head_photo,
        pending_head_photo: '',
        bio: p.bio,
        hasPersonalId: false,
        totalGoals: stats?.goals ?? 0,
        gamesPlayed: stats?.gamesPlayed ?? 0,
      };
    }),
  };
}

export function formatMatchForApi(match: MockMatch) {
  return {
    id: match.id,
    date: match.date,
    location: match.location,
    phase: match.phase,
    team1Id: match.team1Id,
    team2Id: match.team2Id,
    score1: match.score1,
    score2: match.score2,
    goals: match.goals.map((g) => ({ memberId: g.memberId, minute: g.minute })),
    commentCount: 0,
  };
}
