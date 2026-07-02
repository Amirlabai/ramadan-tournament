import { Division, MatchPhase, TeamStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from '../services/CacheService';
import { SeasonService } from '../services/SeasonService';
import { addDaysToDateString, getNthAllowedMatchDate, jerusalemDateTime } from '../utils/jerusalemDate';
import { singleRoundRobinPairs } from '../utils/roundRobin';
import { assertProductionConfirmed } from '../../prisma/seedHelpers';

const DEFAULT_LOCATION = 'מתנס';

export interface GenerateFixturesOptions {
  startDate: string;
  division?: Division;
  matchesPerDay?: number;
  times?: string[];
  location?: string;
  matchDays?: number[];
  replace?: boolean;
  dryRun?: boolean;
}

export interface GeneratedFixture {
  id: number;
  team1Id: number;
  team2Id: number;
  date: Date;
  dateLabel: string;
  location: string;
}

function printHelp(): void {
  console.log(`Usage: npm run fixtures:generate -- [options]

Generate single round-robin group fixtures for all active teams in the active season.

Required:
  --start-date YYYY-MM-DD   First calendar day for placeholder scheduling

Options:
  --division boys|girls     Default: boys
  --matches-per-day N       Default: 2
  --times HH:MM,...         Jerusalem wall-clock slots (default: 18:00,20:00)
  --location TEXT           Default: מתנס
  --match-days fri,sat      Only schedule on these weekdays (sun–sat); omit for consecutive days
  --replace                 Delete existing group matches first
  --dry-run                 Print pairings without writing
  --yes                     Required when DATABASE_URL is not localhost
  --help                    Show this message

Examples:
  npm run fixtures:generate -- --start-date 2026-07-10 --matches-per-day 8 --times 16:00,16:00,17:00,17:00,18:00,18:00,19:00,19:00 --match-days fri,sat --dry-run
  npm run fixtures:generate -- --start-date 2026-07-01 --replace --yes
`);
}

const WEEKDAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseMatchDays(raw: string | undefined): number[] | undefined {
  if (!raw) return undefined;
  const tokens = raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) {
    throw new Error('--match-days must include at least one weekday (sun–sat)');
  }
  const days = tokens.map((token) => {
    const day = WEEKDAY_ALIASES[token];
    if (day === undefined) {
      throw new Error(`Unknown weekday in --match-days: ${token}`);
    }
    return day;
  });
  return [...new Set(days)];
}

function parseArgs(argv: string[]): GenerateFixturesOptions {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const startDate = get('--start-date');
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error('--start-date YYYY-MM-DD is required');
  }

  const divisionRaw = get('--division') ?? 'boys';
  const division = divisionRaw === 'girls' ? Division.girls : Division.boys;

  const matchesPerDay = Math.max(1, parseInt(get('--matches-per-day') ?? '2', 10));
  const timesRaw = get('--times') ?? '18:00,20:00';
  const times = timesRaw.split(',').map((t) => t.trim()).filter(Boolean);
  if (!times.length) {
    throw new Error('--times must include at least one HH:MM value');
  }

  return {
    startDate,
    division,
    matchesPerDay,
    times,
    location: (get('--location') ?? DEFAULT_LOCATION).slice(0, 120),
    matchDays: parseMatchDays(get('--match-days')),
    replace: argv.includes('--replace'),
    dryRun: argv.includes('--dry-run'),
  };
}

export async function generateGroupFixtures(opts: GenerateFixturesOptions): Promise<GeneratedFixture[]> {
  const season = await SeasonService.getActiveSeason(opts.division ?? Division.boys);

  const teams = await prisma.team.findMany({
    where: { seasonId: season.id, status: TeamStatus.active },
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });

  if (teams.length < 2) {
    throw new Error(
      `Need at least 2 active teams (found ${teams.length}). Create and approve teams first.`
    );
  }

  const existingGroup = await prisma.match.count({
    where: { seasonId: season.id, phase: MatchPhase.group },
  });

  if (existingGroup > 0 && !opts.replace) {
    throw new Error(
      `${existingGroup} group matches already exist. Pass --replace to delete and regenerate.`
    );
  }

  const pairs = singleRoundRobinPairs(teams.map((t) => t.id));
  const matchesPerDay = opts.matchesPerDay ?? 2;
  const times = opts.times ?? ['18:00', '20:00'];
  const location = opts.location ?? DEFAULT_LOCATION;
  const matchDays = opts.matchDays;

  const maxIdRow = await prisma.match.aggregate({
    _max: { id: true },
  });
  const nextMatchId = (maxIdRow._max.id ?? 0) + 1;

  const fixtures: GeneratedFixture[] = pairs.map(([team1Id, team2Id], index) => {
    const dayOffset = Math.floor(index / matchesPerDay);
    const dateStr = matchDays?.length
      ? getNthAllowedMatchDate(opts.startDate, dayOffset, matchDays)
      : addDaysToDateString(opts.startDate, dayOffset);
    const timeStr = times[index % times.length];
    const date = jerusalemDateTime(dateStr, timeStr);
    const id = nextMatchId + index;
    return {
      id,
      team1Id,
      team2Id,
      date,
      dateLabel: `${dateStr} ${timeStr}`,
      location,
    };
  });

  if (opts.dryRun) {
    console.log(`Dry run: ${fixtures.length} matches for ${teams.length} teams (${season.displayName})`);
    for (const f of fixtures) {
      const t1 = teams.find((t) => t.id === f.team1Id)?.name ?? f.team1Id;
      const t2 = teams.find((t) => t.id === f.team2Id)?.name ?? f.team2Id;
      console.log(`  #${f.id} ${f.dateLabel} — ${t1} vs ${t2} @ ${f.location}`);
    }
    return fixtures;
  }

  if (existingGroup > 0 && opts.replace) {
    await prisma.$transaction(async (tx) => {
      const groupMatchIds = (
        await tx.match.findMany({
          where: { seasonId: season.id, phase: MatchPhase.group },
          select: { id: true },
        })
      ).map((m) => m.id);

      if (groupMatchIds.length) {
        await tx.goal.deleteMany({ where: { matchId: { in: groupMatchIds } } });
        await tx.comment.deleteMany({ where: { matchId: { in: groupMatchIds } } });
        await tx.match.deleteMany({
          where: { seasonId: season.id, phase: MatchPhase.group },
        });
      }
    });
  }

  await prisma.$transaction(
    fixtures.map((f) =>
      prisma.match.create({
        data: {
          id: f.id,
          seasonId: season.id,
          date: f.date,
          location: f.location,
          phase: MatchPhase.group,
          team1Id: f.team1Id,
          team2Id: f.team2Id,
        },
      })
    )
  );

  const cacheDivision = opts.division === Division.girls ? 'girls' : 'boys';
  await CacheService.invalidatePattern(`rt:doc:${cacheDivision}:*`);

  console.log(`Created ${fixtures.length} group matches starting ${opts.startDate}.`);
  return fixtures;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const { loadServerEnvFromCwd } = await import('../config/loadServerEnv');
  loadServerEnvFromCwd();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  assertProductionConfirmed(argv);

  const opts = parseArgs(argv);
  await generateGroupFixtures(opts);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
