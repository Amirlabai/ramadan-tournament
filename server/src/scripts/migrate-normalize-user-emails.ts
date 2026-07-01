/**
 * Canonicalize users.email via shared normalizeEmail (Gmail dots, +tag, googlemail.com).
 *
 * Usage:
 *   npm run migrate:user-emails -- --dry-run
 *   npm run migrate:user-emails -- --yes
 */
import { loadServerEnv } from '../config/loadServerEnv';
import { prisma } from '../lib/prisma';
import { assertProductionConfirmed } from '../../prisma/seedHelpers';
import { normalizeEmail } from '../utils/normalizeEmail';

loadServerEnv();

type Row = { id: string; email: string | null };

function printHelp(): void {
  console.log(`Usage: npm run migrate:user-emails -- [options]

Rewrites users.email to the canonical form used by auth (Gmail dot/+ normalization).

Options:
  --dry-run   Report rows that would change; no writes
  --yes       Required when DATABASE_URL is not localhost
  --help      Show this message

Rows that normalize to the same address as another user are reported as conflicts and skipped.
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  await runMigrateUserEmails(args);
}

export async function runMigrateUserEmails(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  if (!dryRun) {
    assertProductionConfirmed(args);
  }

  const rows = await prisma.user.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true },
  });

  const conflicts = new Map<string, Row[]>();
  let skippedInvalid = 0;

  for (const row of rows) {
    const canonical = normalizeEmail(row.email!);
    if (!canonical) {
      skippedInvalid++;
      console.warn(`skip invalid email user=${row.id} email=${row.email}`);
      continue;
    }
    const bucket = conflicts.get(canonical) ?? [];
    bucket.push(row);
    conflicts.set(canonical, bucket);
  }

  let updated = 0;
  let unchanged = 0;
  let conflictGroups = 0;

  for (const [canonical, group] of conflicts) {
    if (group.length > 1) {
      conflictGroups++;
      console.warn(
        `conflict canonical=${canonical} users=${group.map((r) => `${r.id}(${r.email})`).join(', ')} — manual merge required`,
      );
      continue;
    }

    const row = group[0];
    if (row.email === canonical) {
      unchanged++;
      continue;
    }

    console.log(`${dryRun ? 'would update' : 'update'} user=${row.id} ${row.email} -> ${canonical}`);
    updated++;

    if (!dryRun) {
      await prisma.user.update({
        where: { id: row.id },
        data: { email: canonical },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: rows.length,
        updated,
        unchanged,
        conflictGroups,
        skippedInvalid,
      },
      null,
      2,
    ),
  );
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('migrate-normalize-user-emails');

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
