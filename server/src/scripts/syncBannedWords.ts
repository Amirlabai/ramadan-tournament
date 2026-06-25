import { PrismaClient } from '@prisma/client';
import { loadServerEnvFromCwd } from '../config/loadServerEnv';
import { seedBannedWords } from '../../prisma/seedHelpers';

loadServerEnvFromCwd();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to server/.env.');
  process.exit(1);
}

const prisma = new PrismaClient();

seedBannedWords(prisma)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
