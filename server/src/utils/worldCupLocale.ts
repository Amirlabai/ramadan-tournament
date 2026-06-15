import fs from 'fs';
import path from 'path';
import { transliterateLatinName } from './latinToHebrew';

export interface WorldCupLocaleData {
  teams: Record<string, string>;
  teamNames: Record<string, string>;
  players: Record<string, string>;
  playerNames: Record<string, string>;
  positions: Record<string, string>;
  venues: Record<string, string>;
  stages: Record<string, string>;
  groups: Record<string, string>;
}

let cached: WorldCupLocaleData | null = null;
let cachedOverrides: Record<string, string> | null = null;

function resolveLocalePath(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'data', 'worldcup', 'hebrew-locale.json'),
    path.join(process.cwd(), 'data', 'worldcup', 'hebrew-locale.json'),
    path.join(__dirname, '..', '..', '..', 'data', 'worldcup', 'hebrew-locale.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return candidates[0];
}

function loadPlayerOverrides(): Record<string, string> {
  if (cachedOverrides) return cachedOverrides;
  const candidates = [
    path.join(process.cwd(), '..', 'data', 'worldcup', 'player-overrides.json'),
    path.join(process.cwd(), 'data', 'worldcup', 'player-overrides.json'),
    path.join(__dirname, '..', '..', '..', 'data', 'worldcup', 'player-overrides.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      cachedOverrides = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>;
      return cachedOverrides;
    }
  }
  cachedOverrides = {};
  return cachedOverrides;
}

function loadLocale(): WorldCupLocaleData {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(resolveLocalePath(), 'utf-8');
    cached = JSON.parse(raw) as WorldCupLocaleData;
  } catch {
    cached = {
      teams: {},
      teamNames: {},
      players: {},
      playerNames: {},
      positions: {},
      venues: {},
      stages: {},
      groups: {},
    };
  }
  return cached;
}

/** Reset cache (tests). */
export function resetWorldCupLocaleCache(): void {
  cached = null;
  cachedOverrides = null;
}

export function wcTeamName(name: string | undefined | null, id?: number | null): string {
  if (!name?.trim()) return name || '';
  const locale = loadLocale();
  const byName = locale.teamNames[name];
  if (byName) return byName;
  if (id != null) {
    const byId = locale.teams[String(id)];
    if (byId) return byId;
  }
  return name;
}

export function wcPlayerName(name: string | undefined | null, id?: number | null): string {
  if (!name?.trim()) return name || '';
  const overrides = loadPlayerOverrides();
  if (overrides[name]) return overrides[name];
  const locale = loadLocale();
  const byName = locale.playerNames[name];
  if (byName) return byName;
  if (id != null) {
    const byId = locale.players[String(id)];
    if (byId) return byId;
  }
  return transliterateLatinName(name);
}

export function wcVenue(venue: string | undefined | null): string {
  if (!venue?.trim() || venue === '—') return venue || '—';
  return loadLocale().venues[venue] || venue;
}

export function wcPosition(position: string | undefined | null): string {
  if (!position?.trim() || position === '—') return position || '—';
  return loadLocale().positions[position] || position;
}

export function wcStage(stage: string | undefined | null): string {
  if (!stage?.trim()) return '';
  return loadLocale().stages[stage] || stage.replace(/_/g, ' ');
}

export function wcGroup(group: string | undefined | null): string {
  if (!group?.trim()) return '';
  const locale = loadLocale();
  if (locale.groups[group]) return locale.groups[group];
  if (group.startsWith('GROUP_')) return `בית ${group.slice('GROUP_'.length)}`;
  return group;
}
