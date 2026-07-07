import crestMapData from './local-team-crest-map.json';

type CrestMapping = {
  localTeamId: number;
  localAssetPath: string;
};

type CrestSeasonEntry =
  | { mappings: CrestMapping[]; inheritSeasonId?: never }
  | { inheritSeasonId: string; mappings?: never };

export type CrestMapFile = {
  primaryBoysSeasonId: string;
  mockDevSeasonId: string;
  bySeasonId: Record<string, CrestSeasonEntry>;
};

const crestMap = crestMapData as CrestMapFile;

function assertUniqueTeamIds(mappings: CrestMapping[], seasonId: string): void {
  const seen = new Set<number>();
  for (const m of mappings) {
    if (seen.has(m.localTeamId)) {
      throw new Error(
        `Duplicate localTeamId ${m.localTeamId} in local-team-crest-map.json (season ${seasonId})`
      );
    }
    seen.add(m.localTeamId);
  }
}

function resolveSeasonMappings(
  map: CrestMapFile,
  seasonId: string,
  stack = new Set<string>()
): CrestMapping[] | null {
  if (stack.has(seasonId)) {
    throw new Error(`Circular inheritSeasonId chain for season ${seasonId}`);
  }
  stack.add(seasonId);

  const entry = map.bySeasonId[seasonId];
  if (!entry) return null;

  if ('inheritSeasonId' in entry && entry.inheritSeasonId) {
    return resolveSeasonMappings(map, entry.inheritSeasonId, stack);
  }

  const mappings = entry.mappings;
  if (!mappings) return null;

  assertUniqueTeamIds(mappings, seasonId);
  return mappings;
}

function assertCrestMapStructure(map: CrestMapFile): void {
  if (!map.primaryBoysSeasonId) {
    throw new Error('local-team-crest-map.json: primaryBoysSeasonId is required');
  }
  if (!map.mockDevSeasonId) {
    throw new Error('local-team-crest-map.json: mockDevSeasonId is required');
  }
  if (!map.bySeasonId[map.primaryBoysSeasonId]) {
    throw new Error(
      `local-team-crest-map.json: primaryBoysSeasonId "${map.primaryBoysSeasonId}" missing from bySeasonId`
    );
  }
  if (!map.bySeasonId[map.mockDevSeasonId]) {
    throw new Error(
      `local-team-crest-map.json: mockDevSeasonId "${map.mockDevSeasonId}" missing from bySeasonId`
    );
  }

  for (const [seasonId, entry] of Object.entries(map.bySeasonId)) {
    if ('inheritSeasonId' in entry && entry.inheritSeasonId) {
      if (!map.bySeasonId[entry.inheritSeasonId]) {
        throw new Error(
          `local-team-crest-map.json: inheritSeasonId "${entry.inheritSeasonId}" for season "${seasonId}" not found in bySeasonId`
        );
      }
    }
  }
}

export function buildLogosBySeasonId(
  map: CrestMapFile
): Readonly<Record<string, Readonly<Record<number, string>>>> {
  assertCrestMapStructure(map);

  const out: Record<string, Record<number, string>> = {};
  for (const seasonId of Object.keys(map.bySeasonId)) {
    const mappings = resolveSeasonMappings(map, seasonId);
    if (!mappings) {
      throw new Error(`local-team-crest-map.json: season "${seasonId}" has no mappings`);
    }
    out[seasonId] = Object.fromEntries(mappings.map((m) => [m.localTeamId, m.localAssetPath]));
  }
  return Object.freeze(
    Object.fromEntries(Object.entries(out).map(([id, logos]) => [id, Object.freeze(logos)]))
  );
}

/** Production boys season UUID — update in local-team-crest-map.json when rotating season. */
export const BOYS_DEFAULT_LOGO_SEASON_ID = crestMap.primaryBoysSeasonId;

/** Mock dev boys season — must match `mockDevSeasonId` in local-team-crest-map.json. */
export const MOCK_DEV_SEASON_ID = crestMap.mockDevSeasonId;

export const TEAM_DEFAULT_LOGO_BY_SEASON_ID = buildLogosBySeasonId(crestMap);

/** @deprecated Prefer season-scoped lookup via effectiveTeamLogoUrl. */
export const TEAM_DEFAULT_LOGO_BY_ID: Readonly<Record<number, string>> =
  TEAM_DEFAULT_LOGO_BY_SEASON_ID[BOYS_DEFAULT_LOGO_SEASON_ID] ?? Object.freeze({});

/** Stored custom logo from DB/uploads; empty when owner has not uploaded one. */
export function teamCustomLogoUrl(logoUrl?: string | null): string {
  return (logoUrl || '').trim();
}

/** Logo shown in UI: custom upload, else static default crest for mapped teams in that season. */
export function effectiveTeamLogoUrl(
  teamId: number,
  logoUrl?: string | null,
  seasonId?: string | null
): string {
  const custom = teamCustomLogoUrl(logoUrl);
  if (custom) return custom;
  if (!seasonId) return '';
  const seasonMap = TEAM_DEFAULT_LOGO_BY_SEASON_ID[seasonId];
  if (!seasonMap) return '';
  return seasonMap[teamId] || '';
}
