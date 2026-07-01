/**
 * Migrate legacy plaintext personal IDs in *_enc columns to v1: AES-GCM ciphertext.
 *
 * Usage:
 *   npm run migrate:personal-ids -- --dry-run
 *   npm run migrate:personal-ids -- --yes
 */
import { loadServerEnv } from '../config/loadServerEnv';
import { prisma } from '../lib/prisma';
import { assertProductionConfirmed } from '../../prisma/seedHelpers';
import { config } from '../config/env';
import { reEncryptStoredPersonalId } from '../utils/personalIdCrypto';

loadServerEnv();

type TableStats = {
  scanned: number;
  migrated: number;
  alreadyEncrypted: number;
  skipped: number;
};

function emptyStats(): TableStats {
  return { scanned: 0, migrated: 0, alreadyEncrypted: 0, skipped: 0 };
}

function applyColumnMigration(
  stats: TableStats,
  current: string | null,
  dryRun: boolean
): string | null | undefined {
  if (current == null) return undefined;
  stats.scanned++;
  const result = reEncryptStoredPersonalId(current);
  if (result.action === 'skip') {
    stats.skipped++;
    return undefined;
  }
  if (result.action === 'unchanged') {
    stats.alreadyEncrypted++;
    return undefined;
  }
  stats.migrated++;
  if (dryRun) return undefined;
  return result.value;
}

function printHelp(): void {
  console.log(`Usage: npm run migrate:personal-ids -- [options]

Re-encrypt legacy plaintext values in personal_id_enc columns (requires PERSONAL_ID_KEY).

Tables: season_registrations (user + admin), players, form_prereg_entries

Options:
  --dry-run   Report rows that would change; no writes
  --yes       Required when DATABASE_URL is not localhost
  --help      Show this message

After a successful live run on production, set PERSONAL_ID_MIGRATION_DONE=1 in env.
`);
}

async function migrateSeasonRegistrations(dryRun: boolean): Promise<TableStats> {
  const stats = emptyStats();
  const rows = await prisma.seasonRegistration.findMany({
    select: { id: true, userPersonalIdEnc: true, adminPersonalIdEnc: true },
  });

  for (const row of rows) {
    const userEnc = applyColumnMigration(stats, row.userPersonalIdEnc, dryRun);
    const adminEnc = applyColumnMigration(stats, row.adminPersonalIdEnc, dryRun);
    if (userEnc === undefined && adminEnc === undefined) continue;

    if (!dryRun) {
      await prisma.seasonRegistration.update({
        where: { id: row.id },
        data: {
          ...(userEnc !== undefined ? { userPersonalIdEnc: userEnc } : {}),
          ...(adminEnc !== undefined ? { adminPersonalIdEnc: adminEnc } : {}),
        },
      });
    }
  }

  return stats;
}

async function migratePlayers(dryRun: boolean): Promise<TableStats> {
  const stats = emptyStats();
  const rows = await prisma.player.findMany({
    select: { memberId: true, personalIdEnc: true },
  });

  for (const row of rows) {
    const next = applyColumnMigration(stats, row.personalIdEnc, dryRun);
    if (next === undefined) continue;
    if (!dryRun) {
      await prisma.player.update({
        where: { memberId: row.memberId },
        data: { personalIdEnc: next },
      });
    }
  }

  return stats;
}

async function migrateFormPreregEntries(dryRun: boolean): Promise<TableStats> {
  const stats = emptyStats();
  const rows = await prisma.formPreregEntry.findMany({
    select: { id: true, personalIdEnc: true },
  });

  for (const row of rows) {
    const next = applyColumnMigration(stats, row.personalIdEnc, dryRun);
    if (next === undefined) continue;
    if (!dryRun) {
      await prisma.formPreregEntry.update({
        where: { id: row.id },
        data: { personalIdEnc: next },
      });
    }
  }

  return stats;
}

function printStats(label: string, stats: TableStats): void {
  console.log(
    `${label}: scanned=${stats.scanned} migrate=${stats.migrated} encrypted=${stats.alreadyEncrypted} skipped=${stats.skipped}`
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const dryRun = argv.includes('--dry-run');
  assertProductionConfirmed(argv);

  if (!config.personalIdKey) {
    console.error('PERSONAL_ID_KEY must be set in server/.env before running this migration.');
    process.exit(1);
  }

  console.log(`Mode: ${dryRun ? 'dry-run' : 'live'}`);
  console.log('Scanning for legacy plaintext IDs (5–9 digits, not v1: prefix)…\n');

  const seasonStats = await migrateSeasonRegistrations(dryRun);
  const playerStats = await migratePlayers(dryRun);
  const preregStats = await migrateFormPreregEntries(dryRun);

  printStats('season_registrations', seasonStats);
  printStats('players', playerStats);
  printStats('form_prereg_entries', preregStats);

  const totalMigrated = seasonStats.migrated + playerStats.migrated + preregStats.migrated;
  console.log(`\nTotal columns to migrate: ${totalMigrated}`);

  if (dryRun && totalMigrated > 0) {
    console.log('\nRe-run without --dry-run (and --yes if remote) to apply changes.');
  } else if (!dryRun && totalMigrated > 0) {
    console.log('\nMigration complete. Set PERSONAL_ID_MIGRATION_DONE=1 in production env.');
  } else if (totalMigrated === 0) {
    console.log('\nNo legacy plaintext personal IDs found.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
