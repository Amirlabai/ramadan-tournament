import { PrismaClient } from '@prisma/client';
import { loadServerEnvFromCwd } from '../src/config/loadServerEnv';
import { wipeDatabase } from './wipeDatabase';
import {
  assertProductionConfirmed,
  createAdminUser,
  createBoysSeason,
  seedBannedWords,
} from './seedHelpers';
import { InvoiceRateLimitService } from '../src/services/InvoiceRateLimitService';

loadServerEnvFromCwd();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to server/.env.');
  process.exit(1);
}

assertProductionConfirmed(process.argv.slice(2));

const prisma = new PrismaClient();

async function main() {
  console.log('Fresh seed: season + admin only (no teams, players, or matches)...');

  await wipeDatabase(prisma);

  await InvoiceRateLimitService.clearAllAttempts().catch(() => {
    console.warn('Could not clear Redis invoice rate-limit keys (REDIS_URL unset or unreachable).');
  });

  const season = await createBoysSeason(prisma);
  const adminUsername = await createAdminUser(prisma);
  await seedBannedWords(prisma);

  console.log(`Season: ${season.displayName} (${season.yearMonth})`);
  console.log(`Admin user: ${adminUsername}`);
  console.log('Fresh seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
