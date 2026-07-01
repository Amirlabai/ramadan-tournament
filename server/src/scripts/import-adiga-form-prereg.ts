/**
 * Import Google Form preregistration into Postgres (fill-only).
 * Inserts missing form_prereg_entries rows only — never updates or deletes existing DB data.
 * Usage:
 *   npm run import:prereg -- [--csv path] [--season-id uuid]
 *   npm run import:prereg -- --json [--json-partial path] [--season-id uuid]
 */
import fs from 'fs';
import path from 'path';
import { Division, FormPreregAdminMissing, FormPreregRole } from '@prisma/client';
import { assertProductionConfirmed } from '../../prisma/seedHelpers';
import { loadServerEnv } from '../config/loadServerEnv';
import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';
import {
  DEFAULT_PREREG_JSON,
  loadFormPreregFromJson,
} from '../utils/loadFormPreregJson';
import { encryptPersonalId } from '../utils/personalIdCrypto';
import {
  flattenParsedFormPeople,
  identityKey,
  normalizePersonName,
  personTeamRoleKey,
  shouldSkipPreregInsertWithKeys,
} from '../utils/formImportMerge';
import { parseAdigaFormCsvContent, type FormPreregParseResult } from '../utils/parseAdigaFormCsv';

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

function parseArgs(argv: string[]): {
  source: 'csv' | 'json';
  csvPath: string;
  jsonFullPath: string;
  jsonPartialPath: string;
  seasonId?: string;
} {
  let csvPath = DEFAULT_CSV;
  let jsonFullPath = DEFAULT_PREREG_JSON.full;
  let jsonPartialPath = DEFAULT_PREREG_JSON.partial;
  let seasonId: string | undefined;
  let source: 'csv' | 'json' = 'csv';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes') continue;
    if (arg === '--season-id' && argv[i + 1]) {
      seasonId = argv[++i];
    } else if (arg === '--csv' && argv[i + 1]) {
      source = 'csv';
      csvPath = argv[++i]!;
    } else if (arg === '--json') {
      source = 'json';
      if (argv[i + 1] && !argv[i + 1]!.startsWith('--')) {
        jsonFullPath = argv[++i]!;
      }
    } else if (arg === '--json-partial' && argv[i + 1]) {
      jsonPartialPath = argv[++i]!;
    } else if (arg === '--replace') {
      console.error(
        'import:prereg is fill-only. Existing Postgres rows are never replaced.\n' +
          'Omit --replace (removed). Re-import only adds missing entries.'
      );
      process.exit(1);
    } else if (!arg.startsWith('--')) {
      csvPath = arg;
    }
  }

  return { source, csvPath, jsonFullPath, jsonPartialPath, seasonId };
}

function toRole(role: 'captain' | 'goalkeeper' | 'player'): FormPreregRole {
  if (role === 'captain') return FormPreregRole.captain;
  if (role === 'goalkeeper') return FormPreregRole.goalkeeper;
  return FormPreregRole.player;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  assertProductionConfirmed(argv);

  const { source, csvPath, jsonFullPath, jsonPartialPath, seasonId: seasonIdArg } =
    parseArgs(process.argv);

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  if (!process.env.PERSONAL_ID_KEY) {
    console.error(
      'PERSONAL_ID_KEY is required for encrypted import.\n' +
        'Add to server/.env — must match the API host (Render env var).\n' +
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
    process.exit(1);
  }

  const season =
    seasonIdArg != null
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonIdArg } })
      : await SeasonService.getActiveSeasonForDivision(Division.boys);

  let parsed: FormPreregParseResult;
  let sourceLabel: string;

  if (source === 'json') {
    const resolvedFull = path.isAbsolute(jsonFullPath)
      ? jsonFullPath
      : path.join(repoRoot(), jsonFullPath);
    const resolvedPartial = path.isAbsolute(jsonPartialPath)
      ? jsonPartialPath
      : path.join(repoRoot(), jsonPartialPath);
    if (!fs.existsSync(resolvedFull)) {
      console.error(`JSON not found: ${resolvedFull}`);
      process.exit(1);
    }
    parsed = loadFormPreregFromJson(resolvedFull, resolvedPartial);
    sourceLabel = `JSON → Postgres form_prereg_entries (${path.basename(resolvedFull)} + ${path.basename(resolvedPartial)})`;
  } else {
    const resolved = path.isAbsolute(csvPath) ? csvPath : path.join(repoRoot(), csvPath);
    if (!fs.existsSync(resolved)) {
      console.error(`CSV not found: ${resolved}`);
      process.exit(1);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    parsed = parseAdigaFormCsvContent(content);
    sourceLabel = `CSV → Postgres form_prereg_entries (${path.basename(resolved)})`;
  }

  const { full, partial, report } = parsed;

  console.log(`Season: ${season.displayName} (${season.id})`);
  console.log(`Source: ${sourceLabel}`);
  console.log(`Parsed: ${full.length} complete, ${partial.length} partial`);
  console.log('Mode: fill-only (existing Postgres rows untouched, inserts missing only)');

  const importedAt = new Date();
  const people = flattenParsedFormPeople(full, partial);

  const [existingRows, linkedPlayers] = await Promise.all([
    prisma.formPreregEntry.findMany({ where: { seasonId: season.id } }),
    prisma.player.findMany({
      where: { seasonId: season.id, userId: { not: null } },
      select: { personalIdEnc: true, birthYear: true },
    }),
  ]);

  const existingRoleKeys = new Set(
    existingRows.map((row) => personTeamRoleKey(row.teamName, row.name, row.role))
  );
  const existingFullIdentityKeys = new Set<string>();
  const existingPartialIdKeys = new Set<string>();
  const existingPartialYearKeys = new Set<string>();

  for (const row of existingRows) {
    if (row.personalIdEnc && row.birthYear != null && !row.adminMissing) {
      existingFullIdentityKeys.add(identityKey(row.personalIdEnc, row.birthYear));
    } else if (row.personalIdEnc) {
      existingPartialIdKeys.add(row.personalIdEnc);
    } else if (row.birthYear != null) {
      existingPartialYearKeys.add(
        `${row.teamName.trim()}|${normalizePersonName(row.name)}|${row.birthYear}|${row.role}`
      );
    }
  }

  const linkedIdentityKeys = new Set<string>();
  for (const player of linkedPlayers) {
    if (player.personalIdEnc && player.birthYear != null) {
      linkedIdentityKeys.add(identityKey(player.personalIdEnc, player.birthYear));
    }
    if (player.personalIdEnc) {
      linkedIdentityKeys.add(player.personalIdEnc);
    }
  }

  const toInsert: Array<{
    seasonId: string;
    name: string;
    captainEmail: string | null;
    personalIdEnc: string | null;
    birthYear: number | null;
    adminMissing: FormPreregAdminMissing | null;
    teamName: string;
    role: FormPreregRole;
    importedAt: Date;
  }> = [];

  const skipped: Array<{ name: string; teamName: string; reason: string }> = [];

  for (const entry of people) {
    const skipReason = shouldSkipPreregInsertWithKeys(
      entry,
      existingRoleKeys,
      existingFullIdentityKeys,
      existingPartialIdKeys,
      existingPartialYearKeys,
      linkedIdentityKeys,
      encryptPersonalId
    );

    if (skipReason) {
      skipped.push({ name: entry.name, teamName: entry.teamName, reason: skipReason });
      continue;
    }

    if (entry.kind === 'full') {
      const idEnc = encryptPersonalId(entry.personalId);
      toInsert.push({
        seasonId: season.id,
        name: entry.name,
        captainEmail: entry.email ?? null,
        personalIdEnc: idEnc,
        birthYear: entry.birthYear,
        adminMissing: null,
        teamName: entry.teamName,
        role: toRole(entry.role),
        importedAt,
      });
      existingRoleKeys.add(personTeamRoleKey(entry.teamName, entry.name, entry.role));
      existingFullIdentityKeys.add(identityKey(idEnc, entry.birthYear));
      continue;
    }

    const idEnc = entry.personalId ? encryptPersonalId(entry.personalId) : null;
    toInsert.push({
      seasonId: season.id,
      name: entry.name,
      captainEmail: entry.email ?? null,
      personalIdEnc: idEnc,
      birthYear: entry.birthYear ?? null,
      adminMissing:
        entry.adminMissing === 'personal_id'
          ? FormPreregAdminMissing.personal_id
          : FormPreregAdminMissing.birth_year,
      teamName: entry.teamName,
      role: toRole(entry.role),
      importedAt,
    });
    existingRoleKeys.add(personTeamRoleKey(entry.teamName, entry.name, entry.role));
    if (idEnc) existingPartialIdKeys.add(idEnc);
    if (entry.birthYear != null) {
      existingPartialYearKeys.add(
        `${entry.teamName.trim()}|${normalizePersonName(entry.name)}|${entry.birthYear}|${entry.role}`
      );
    }
  }

  if (toInsert.length > 0) {
    // createMany skips duplicates silently if a concurrent import races (acceptable for one-off fill-only script)
    await prisma.formPreregEntry.createMany({ data: toInsert });
  }

  console.log(
    `Fill prereg: +${toInsert.length} inserted, ${skipped.length} skipped (already in Postgres), ${report.length} skipped in parse`
  );
  if (skipped.length > 0) {
    const byReason = skipped.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = (acc[row.reason] ?? 0) + 1;
      return acc;
    }, {});
    console.log('Skip reasons:', byReason);
  }
  console.log(`Source files loaded (${source})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
