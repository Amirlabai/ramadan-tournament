/**
 * Fill missing Google Form CSV roster placeholders into Postgres (add-only).
 * Existing teams and players in Postgres are never updated or deleted.
 * Usage: npm run import:roster -- [--csv path] [--season-id uuid] [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { Division, SquadRole } from '@prisma/client';
import { assertProductionConfirmed } from '../../prisma/seedHelpers';
import { loadServerEnv } from '../config/loadServerEnv';
import { prisma } from '../lib/prisma';
import { invalidateDivisionCaches } from '../services/registrationHelpers';
import { SeasonService } from '../services/SeasonService';
import { encryptPersonalId } from '../utils/personalIdCrypto';
import {
  flattenParsedFormPeople,
  identityKey,
  nextJerseyNumber,
  shouldSkipRosterInsert,
  splitFormPersonName,
  type ExistingRosterPlayer,
  type ParsedFormPerson,
} from '../utils/formImportMerge';
import { parseAdigaFormCsvContent } from '../utils/parseAdigaFormCsv';

loadServerEnv();

const DEFAULT_CSV = path.join(
  process.cwd(),
  '..',
  '.incoming',
  'ADIGA WORLD CUP 2026 ⚽ (תגובות) - תגובות לטופס 1(1).csv'
);

function repoRoot(): string {
  return path.join(process.cwd(), '..');
}

function parseArgs(argv: string[]): { csvPath: string; seasonId?: string; dryRun: boolean } {
  let csvPath = DEFAULT_CSV;
  let seasonId: string | undefined;
  let dryRun = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes') continue;
    if (arg === '--season-id' && argv[i + 1]) {
      seasonId = argv[++i];
    } else if (arg === '--csv' && argv[i + 1]) {
      csvPath = argv[++i]!;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('--')) {
      csvPath = arg;
    }
  }

  return { csvPath, seasonId, dryRun };
}

function squadRoleFor(role: 'captain' | 'goalkeeper' | 'player'): SquadRole | null {
  if (role === 'captain') return SquadRole.captain;
  if (role === 'goalkeeper') return SquadRole.goalkeeper;
  return null;
}

function positionFor(role: 'captain' | 'goalkeeper' | 'player'): string {
  if (role === 'goalkeeper') return 'שוער';
  if (role === 'captain') return '';
  return 'מחמם ספסל';
}

type PendingPlayer = {
  teamName: string;
  entry: ParsedFormPerson;
  names: ReturnType<typeof splitFormPersonName>;
  number: number;
  personalIdEnc: string | null;
  birthYear: number | null;
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { csvPath, seasonId: seasonIdArg, dryRun } = parseArgs(process.argv);
  const resolved = path.isAbsolute(csvPath) ? csvPath : path.join(repoRoot(), csvPath);

  if (!fs.existsSync(resolved)) {
    console.error(`CSV not found: ${resolved}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  if (!dryRun) {
    assertProductionConfirmed(argv);
    if (!process.env.PERSONAL_ID_KEY) {
      console.error(
        'PERSONAL_ID_KEY is required for roster import (encrypts personal IDs).\n' +
          'Add to server/.env — must match the API host (Render env var).'
      );
      process.exit(1);
    }
  }

  const season =
    seasonIdArg != null
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonIdArg } })
      : await SeasonService.getActiveSeasonForDivision(Division.boys);

  console.log(`Season: ${season.displayName} (${season.id})`);
  console.log(`Source: CSV → Postgres teams/players (${path.basename(resolved)})`);
  console.log(
    dryRun
      ? 'Mode: dry-run (no writes)'
      : 'Mode: fill-only (existing Postgres teams/players untouched, inserts missing only)'
  );

  const content = fs.readFileSync(resolved, 'utf-8');
  const { full, partial, report } = parseAdigaFormCsvContent(content);
  const people = flattenParsedFormPeople(full, partial);

  const [existingTeams, existingPlayers, maxMember] = await Promise.all([
    prisma.team.findMany({ where: { seasonId: season.id } }),
    prisma.player.findMany({
      where: { seasonId: season.id, active: true },
      include: { team: { select: { name: true } } },
    }),
    prisma.player.aggregate({ _max: { memberId: true } }),
  ]);

  const teamByName = new Map(existingTeams.map((t) => [t.name.trim(), t]));

  const rosterRows: ExistingRosterPlayer[] = existingPlayers.map((p) => ({
    memberId: p.memberId,
    teamId: p.teamId,
    teamName: p.team.name,
    userId: p.userId,
    firstName: p.firstName,
    lastName: p.lastName,
    nickname: p.nickname,
    personalIdEnc: p.personalIdEnc,
    birthYear: p.birthYear,
  }));

  const linkedIdentityKeys = new Set<string>();
  for (const player of rosterRows) {
    if (!player.userId) continue;
    if (player.personalIdEnc && player.birthYear != null) {
      linkedIdentityKeys.add(identityKey(player.personalIdEnc, player.birthYear));
    }
    if (player.personalIdEnc) {
      linkedIdentityKeys.add(player.personalIdEnc);
    }
  }

  const teamsToCreate: string[] = [];
  const pendingPlayers: PendingPlayer[] = [];
  const skipped: Array<{ teamName: string; name: string; reason: string }> = [];

  const teamNamesInCsv = [...new Set(people.map((p) => p.teamName.trim()))];
  const jerseyByTeam = new Map<string, number[]>();

  for (const teamName of teamNamesInCsv) {
    const team = teamByName.get(teamName);
    if (!team) {
      teamsToCreate.push(teamName);
    }

    const teamPeople = people.filter((p) => p.teamName.trim() === teamName);
    const teamId = team?.id;
    const jerseyUsed =
      teamId != null
        ? existingPlayers.filter((p) => p.teamId === teamId).map((p) => p.number)
        : [];
    jerseyByTeam.set(teamName, [...jerseyUsed]);

    for (const entry of teamPeople) {
      const skipReason = shouldSkipRosterInsert(
        entry,
        teamName,
        teamId,
        rosterRows,
        linkedIdentityKeys,
        encryptPersonalId
      );

      if (skipReason) {
        skipped.push({ teamName, name: entry.name, reason: skipReason });
        continue;
      }

      const names = splitFormPersonName(entry.name);
      const jerseyUsedForTeam = jerseyByTeam.get(teamName)!;
      const number = nextJerseyNumber(jerseyUsedForTeam);
      jerseyUsedForTeam.push(number);

      const personalIdEnc =
        entry.kind === 'full'
          ? encryptPersonalId(entry.personalId)
          : entry.personalId
            ? encryptPersonalId(entry.personalId)
            : null;
      const birthYear =
        entry.kind === 'full' ? entry.birthYear : (entry.birthYear ?? null);

      pendingPlayers.push({
        teamName,
        entry,
        names,
        number,
        personalIdEnc,
        birthYear,
      });
    }
  }

  if (dryRun) {
    for (const teamName of teamsToCreate) {
      console.log(`Would create team: ${teamName}`);
    }
    for (const pending of pendingPlayers) {
      console.log(`Would add player: ${pending.entry.name} (${pending.teamName})`);
    }
  } else if (teamsToCreate.length > 0 || pendingPlayers.length > 0) {
    await prisma.$transaction(async (tx) => {
      let nextTeamId =
        (await tx.team.aggregate({ where: { seasonId: season.id }, _max: { id: true } }))._max.id ?? 0;
      let nextMemberId = (maxMember._max.memberId ?? 0) + 1;

      for (const teamName of teamsToCreate) {
        nextTeamId += 1;
        const team = await tx.team.create({
          data: {
            id: nextTeamId,
            seasonId: season.id,
            name: teamName,
            status: 'active',
          },
        });
        teamByName.set(teamName, team);
        console.log(`Created team #${team.id}: ${teamName}`);
      }

      for (const pending of pendingPlayers) {
        const team = teamByName.get(pending.teamName);
        if (!team) {
          throw new Error(`Team missing after create: ${pending.teamName}`);
        }

        const memberId = nextMemberId++;
        await tx.player.create({
          data: {
            memberId,
            teamId: team.id,
            seasonId: season.id,
            userId: null,
            firstName: pending.names.firstName,
            lastName: pending.names.lastName,
            nickname: pending.names.nickname,
            number: pending.number,
            position: positionFor(pending.entry.role),
            squadRole: squadRoleFor(pending.entry.role),
            isCaptain: pending.entry.role === 'captain',
            bio: `משחק בעד ${pending.teamName}`,
            personalIdEnc: pending.personalIdEnc,
            birthYear: pending.birthYear,
          },
        });

        rosterRows.push({
          memberId,
          teamId: team.id,
          teamName: pending.teamName,
          userId: null,
          firstName: pending.names.firstName,
          lastName: pending.names.lastName,
          nickname: pending.names.nickname,
          personalIdEnc: pending.personalIdEnc,
          birthYear: pending.birthYear,
        });
      }
    });

    await invalidateDivisionCaches(Division.boys);
  }

  for (const teamName of teamNamesInCsv) {
    if (teamByName.has(teamName) && !teamsToCreate.includes(teamName)) {
      const team = teamByName.get(teamName)!;
      console.log(`Existing team unchanged: ${teamName} (#${team.id})`);
    }
  }

  console.log(
    `${dryRun ? 'Would add' : 'Added'} ${pendingPlayers.length} placeholder players across ${teamNamesInCsv.length} teams`
  );
  console.log(`${dryRun ? 'Would create' : 'Created'} ${teamsToCreate.length} new teams`);
  console.log(`Skipped ${skipped.length} (already in Postgres), ${report.length} unparseable in CSV`);

  if (skipped.length > 0) {
    const byReason = skipped.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = (acc[row.reason] ?? 0) + 1;
      return acc;
    }, {});
    console.log('Skip reasons:', byReason);
  }

  console.log(`Source: ${path.basename(resolved)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
