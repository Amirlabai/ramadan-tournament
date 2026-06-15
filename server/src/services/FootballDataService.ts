import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { CacheService } from './CacheService';
import {
  buildDashboard,
  buildCompleteTeamGroupMap,
  buildTeamGroupMapFromMatches,
  filterDisplayableKnockoutMatches,
  normalizeMatchesResponse,
  normalizeScorersResponse,
  normalizeStandingsResponse,
  normalizeTeamsResponse,
  type GroupStanding,
  type NormalizedMatch,
  type NormalizedTeam,
  type NormalizedTopScorer,
} from './WorldCupNormalizer';

const FD_BASE = 'https://api.football-data.org/v4';

function resolveDataDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'data', 'worldcup'),
    path.join(process.cwd(), 'data', 'worldcup'),
    path.join(__dirname, '..', '..', '..', 'data', 'worldcup'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'matches.json'))) return dir;
  }
  return candidates[0];
}

function readMockJson<T>(filename: string): T {
  const filePath = path.join(resolveDataDir(), filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`World Cup mock data missing: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

async function fetchFd<T>(endpoint: string): Promise<T> {
  const apiKey = config.footballDataApiKey;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY not set');
  }
  const res = await fetch(`${FD_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`football-data.org ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function seasonParam(): string {
  return `season=${config.footballDataSeason}`;
}

function competitionPath(): string {
  return `/competitions/${config.footballDataCompetition}`;
}

function cacheTtl(matches: NormalizedMatch[]): number {
  const live = matches.some((m) => m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'PAUSED');
  return live ? 60 : 120;
}

export class FootballDataService {
  static async getMeta(): Promise<Record<string, unknown>> {
    const key = CacheService.key('wc', 'meta', config.footballDataSeason);
    return CacheService.getOrSet(key, 300, async () => {
      try {
        if (config.footballDataApiKey) {
          return await fetchFd(`${competitionPath()}?${seasonParam()}`);
        }
      } catch (err) {
        console.warn('FD meta fetch failed, using mock:', err);
      }
      return readMockJson('meta.json');
    });
  }

  static async getMatches(): Promise<NormalizedMatch[]> {
    const key = CacheService.key('wc', 'matches', config.footballDataSeason);
    const cached = await CacheService.get<NormalizedMatch[]>(key);
    if (cached) return cached;

    try {
      let raw: { matches?: unknown[] };
      if (config.footballDataApiKey) {
        raw = await fetchFd(`${competitionPath()}/matches?${seasonParam()}`);
      } else {
        raw = readMockJson('matches.json');
      }
      const matches = normalizeMatchesResponse(raw as Parameters<typeof normalizeMatchesResponse>[0]);
      await CacheService.set(key, matches, cacheTtl(matches));
      return matches;
    } catch (err) {
      console.warn('FD matches fetch failed, using mock:', err);
      const raw = readMockJson<{ matches: unknown[] }>('matches.json');
      const matches = normalizeMatchesResponse(raw as Parameters<typeof normalizeMatchesResponse>[0]);
      await CacheService.set(key, matches, 120);
      return matches;
    }
  }

  static async getStandings(): Promise<GroupStanding[]> {
    const key = CacheService.key('wc', 'standings', 'v2', config.footballDataSeason);
    return CacheService.getOrSet(key, 120, async () => {
      const matches = await this.getMatches();
      const teamGroupMap = buildCompleteTeamGroupMap(matches);

      try {
        if (config.footballDataApiKey) {
          const raw = await fetchFd(`${competitionPath()}/standings?${seasonParam()}`);
          return normalizeStandingsResponse(
            raw as Parameters<typeof normalizeStandingsResponse>[0],
            teamGroupMap
          );
        }
      } catch (err) {
        console.warn('FD standings fetch failed, using mock:', err);
      }
      const raw = readMockJson('standings.json');
      return normalizeStandingsResponse(
        raw as Parameters<typeof normalizeStandingsResponse>[0],
        teamGroupMap
      );
    });
  }

  static async getTopScorers(): Promise<NormalizedTopScorer[]> {
    const key = CacheService.key('wc', 'scorers', config.footballDataSeason);
    return CacheService.getOrSet(key, 120, async () => {
      try {
        if (config.footballDataApiKey) {
          const raw = await fetchFd(`${competitionPath()}/scorers?${seasonParam()}&limit=50`);
          return normalizeScorersResponse(raw as Parameters<typeof normalizeScorersResponse>[0]);
        }
      } catch (err) {
        console.warn('FD scorers fetch failed, using mock:', err);
      }
      const raw = readMockJson('scorers.json');
      return normalizeScorersResponse(raw as Parameters<typeof normalizeScorersResponse>[0]);
    });
  }

  static async getTeams(): Promise<NormalizedTeam[]> {
    const key = CacheService.key('wc', 'teams', config.footballDataSeason);
    return CacheService.getOrSet(key, 300, async () => {
      try {
        if (config.footballDataApiKey) {
          const raw = await fetchFd(`${competitionPath()}/teams?${seasonParam()}`);
          return normalizeTeamsResponse(raw as Parameters<typeof normalizeTeamsResponse>[0]);
        }
      } catch (err) {
        console.warn('FD teams fetch failed, using mock:', err);
      }
      const raw = readMockJson('teams.json');
      return normalizeTeamsResponse(raw as Parameters<typeof normalizeTeamsResponse>[0]);
    });
  }

  static async getDashboard() {
    const [matches, topScorers] = await Promise.all([
      this.getMatches(),
      this.getTopScorers(),
    ]);
    return buildDashboard(matches, topScorers);
  }

  static async getKnockoutMatches(): Promise<NormalizedMatch[]> {
    const matches = await this.getMatches();
    return filterDisplayableKnockoutMatches(matches);
  }
}
