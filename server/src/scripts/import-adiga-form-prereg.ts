/**
 * Import Google Form CSV preregistration into Postgres (replace-all per season).
 * Usage: npm run import:prereg -- [--csv path] [--season-id uuid]
 */
import fs from 'fs';
import path from 'path';
import { Division, FormPreregAdminMissing, FormPreregRole } from '@prisma/client';
import { loadServerEnv } from '../config/loadServerEnv';
import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';
import { encryptPersonalId } from '../utils/personalIdCrypto';
import { parseAdigaFormCsvContent } from '../utils/parseAdigaFormCsv';

loadServerEnv();

const DEFAULT_CSV = path.join(
  process.cwd(),
  '..',
  '.incoming',
  'ADIGA WORLD CUP 2026 ⚽ (תגובות) - תגובות לטופס 1.csv'
);

function repoRoot(): string {
  return path.join(process.cwd(), '..');
}

function parseArgs(argv: string[]): { csvPath: string; seasonId?: string } {
  let csvPath = DEFAULT_CSV;
  let seasonId: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--season-id' && argv[i + 1]) {
      seasonId = argv[++i];
    } else if (arg === '--csv' && argv[i + 1]) {
      csvPath = argv[++i]!;
    } else if (!arg.startsWith('--')) {
      csvPath = arg;
    }
  }

  return { csvPath, seasonId };
}

function toRole(role: 'captain' | 'goalkeeper' | 'player'): FormPreregRole {
  if (role === 'captain') return FormPreregRole.captain;
  if (role === 'goalkeeper') return FormPreregRole.goalkeeper;
  return FormPreregRole.player;
}

async function main(): Promise<void> {
  const { csvPath, seasonId: seasonIdArg } = parseArgs(process.argv);
  const resolved = path.isAbsolute(csvPath) ? csvPath : path.join(repoRoot(), csvPath);

  if (!fs.existsSync(resolved)) {
    console.error(`CSV not found: ${resolved}`);
    process.exit(1);
  }

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

  console.log(`Season: ${season.displayName} (${season.id})`);

  const content = fs.readFileSync(resolved, 'utf-8');
  const { full, partial, report } = parseAdigaFormCsvContent(content);
  const importedAt = new Date();

  const rows = [
    ...full.map((entry) => ({
      seasonId: season.id,
      name: entry.name,
      captainEmail: entry.email ?? null,
      personalIdEnc: encryptPersonalId(entry.personalId),
      birthYear: entry.birthYear,
      adminMissing: null,
      teamName: entry.teamName,
      role: toRole(entry.role),
      importedAt,
    })),
    ...partial.map((entry) => ({
      seasonId: season.id,
      name: entry.name,
      captainEmail: entry.email ?? null,
      personalIdEnc: entry.personalId ? encryptPersonalId(entry.personalId) : null,
      birthYear: entry.birthYear ?? null,
      adminMissing:
        entry.adminMissing === 'personal_id'
          ? FormPreregAdminMissing.personal_id
          : FormPreregAdminMissing.birth_year,
      teamName: entry.teamName,
      role: toRole(entry.role),
      importedAt,
    })),
  ];

  await prisma.$transaction([
    prisma.formPreregEntry.deleteMany({ where: { seasonId: season.id } }),
    prisma.formPreregEntry.createMany({ data: rows }),
  ]);

  console.log(
    `Imported ${full.length} complete, ${partial.length} partial (${report.length} skipped in parse)`
  );
  console.log(`Source: ${path.basename(resolved)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
