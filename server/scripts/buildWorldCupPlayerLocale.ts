/**
 * Fetches WC squads + scorers from football-data.org and merges into hebrew-locale.json.
 * Run: npx tsx server/scripts/buildWorldCupPlayerLocale.ts
 */
import fs from 'fs';
import path from 'path';
import { transliterateLatinName } from '../src/utils/latinToHebrew';

const FD_BASE = 'https://api.football-data.org/v4';
const LOCALE_PATH = path.join(__dirname, '..', '..', 'data', 'worldcup', 'hebrew-locale.json');
const SEASON = process.env.FOOTBALL_DATA_SEASON || '2026';

async function fetchFd<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY not set');
  const res = await fetch(`${FD_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!res.ok) {
    throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function mergePlayer(
  players: Record<string, string>,
  playerNames: Record<string, string>,
  id: number,
  englishName: string,
  manualByName: Record<string, string>
): void {
  const hebrew = manualByName[englishName] || transliterateLatinName(englishName);

  players[String(id)] = hebrew;
  playerNames[englishName] = hebrew;

  const ascii = englishName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (ascii !== englishName && !playerNames[ascii]) {
    playerNames[ascii] = hebrew;
  }
}

async function main() {
  const season = SEASON;
  const locale = JSON.parse(fs.readFileSync(LOCALE_PATH, 'utf-8')) as {
    players: Record<string, string>;
    playerNames: Record<string, string>;
    playerOverrides?: Record<string, string>;
    [k: string]: unknown;
  };

  const overridesPath = path.join(__dirname, '..', '..', 'data', 'worldcup', 'player-overrides.json');
  const manualByName: Record<string, string> = fs.existsSync(overridesPath)
    ? (JSON.parse(fs.readFileSync(overridesPath, 'utf-8')) as Record<string, string>)
    : {};

  const players: Record<string, string> = {};
  const playerNames: Record<string, string> = {};

  const teamsData = await fetchFd<{
    teams: Array<{
      id: number;
      squad?: Array<{ id: number; name: string }>;
    }>;
  }>(`/competitions/WC/teams?season=${season}`);

  let squadCount = 0;
  for (const team of teamsData.teams || []) {
    for (const p of team.squad || []) {
      mergePlayer(players, playerNames, p.id, p.name, manualByName);
      squadCount += 1;
    }
  }

  const scorersData = await fetchFd<{
    scorers: Array<{ player: { id: number; name: string } }>;
  }>(`/competitions/WC/scorers?season=${season}&limit=100`);

  for (const s of scorersData.scorers || []) {
    mergePlayer(players, playerNames, s.player.id, s.player.name, manualByName);
  }

  const mockDir = path.join(__dirname, '..', '..', 'data', 'worldcup');
  for (const file of ['teams.json', 'scorers.json']) {
    const mockPath = path.join(mockDir, file);
    if (!fs.existsSync(mockPath)) continue;
    const mock = JSON.parse(fs.readFileSync(mockPath, 'utf-8')) as {
      teams?: Array<{ squad?: Array<{ id: number; name: string }> }>;
      scorers?: Array<{ player: { id: number; name: string } }>;
    };
    for (const t of mock.teams || []) {
      for (const p of t.squad || []) {
        mergePlayer(players, playerNames, p.id, p.name, manualByName);
      }
    }
    for (const s of mock.scorers || []) {
      mergePlayer(players, playerNames, s.player.id, s.player.name, manualByName);
    }
  }

  locale.players = players;
  locale.playerNames = playerNames;

  fs.writeFileSync(LOCALE_PATH, JSON.stringify(locale, null, 2) + '\n', 'utf-8');

  console.log(`Updated ${LOCALE_PATH}`);
  console.log(`  squad players processed: ${squadCount}`);
  console.log(`  total players by id: ${Object.keys(players).length}`);
  console.log(`  total playerNames: ${Object.keys(playerNames).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
