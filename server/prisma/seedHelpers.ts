import bcrypt from 'bcrypt';
import { Division, PrismaClient, ScoringMode } from '@prisma/client';
import { jerusalemDateTime } from '../src/utils/jerusalemDate';
import { DEFAULT_BANNED_WORDS } from '../src/data/defaultBannedWords';

export function parseJerusalemDate(dateStr: string): Date {
  return jerusalemDateTime(dateStr, '12:00');
}

export function getDatabaseHost(): string {
  const url = process.env.DATABASE_URL || '';
  try {
    return new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
  } catch {
    return 'unknown';
  }
}

export function assertProductionConfirmed(argv: string[]): void {
  const host = getDatabaseHost();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  console.log(`Target database host: ${host}`);
  if (!isLocal && !argv.includes('--yes')) {
    console.error('Refusing to run against a remote database. Pass --yes to confirm.');
    process.exit(1);
  }
}

export async function createBoysSeason(
  prisma: PrismaClient,
  opts?: { yearMonth?: string; displayName?: string }
) {
  return prisma.season.create({
    data: {
      yearMonth: opts?.yearMonth ?? process.env.SEASON_YEAR_MONTH ?? '2026-06',
      division: Division.boys,
      displayName: opts?.displayName ?? process.env.SEASON_DISPLAY_NAME ?? 'מונדיאל קיץ 2026',
      scoringMode: ScoringMode.football,
      isActive: true,
    },
  });
}

export async function createAdminUser(prisma: PrismaClient): Promise<string> {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD not set — using default admin123 for local seed only');
  }
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
      displayName: 'Admin',
      role: 'admin',
      isVerified: true,
    },
  });
  return adminUsername;
}

export async function seedBannedWords(prisma: PrismaClient): Promise<void> {
  const result = await prisma.bannedWord.createMany({
    data: DEFAULT_BANNED_WORDS.map(({ word, language }) => ({
      word: word.toLowerCase(),
      language,
    })),
    skipDuplicates: true,
  });
  console.log(
    `Banned words: ${result.count} inserted (${DEFAULT_BANNED_WORDS.length} in default list)`
  );
}
