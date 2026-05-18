import { PrismaClient, Division, ScoringMode, MatchPhase, NewsPriority } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to server/.env (Render Postgres Internal URL).');
  process.exit(1);
}

const prisma = new PrismaClient();

function resolveDataDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'data'),
    path.join(__dirname, '..', '..', 'data'),
    path.join(__dirname, '..', '..', '..', 'data'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'teams.json'))) return dir;
  }
  throw new Error('Could not find data/teams.json — run seed from server/ with repo data/ present');
}

const dataDir = resolveDataDir();

function parseJerusalemDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+02:00`);
}

async function main() {
  console.log('Seeding database...');

  // Order matters: Vote.team uses onDelete SetNull on (seasonId, teamId) — delete votes before teams.
  await prisma.$transaction([
    prisma.goal.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.bracketSlot.deleteMany(),
    prisma.match.deleteMany(),
    prisma.vote.deleteMany(),
    prisma.pointEntry.deleteMany(),
    prisma.teamJoinRequest.deleteMany(),
    prisma.teamTransferRequest.deleteMany(),
    prisma.player.deleteMany(),
    prisma.team.deleteMany(),
    prisma.news.deleteMany(),
    prisma.statsSnapshot.deleteMany(),
    prisma.teamCreationRequest.deleteMany(),
    prisma.invoiceCode.deleteMany(),
    prisma.seasonRegistration.deleteMany(),
    prisma.seasonArchive.deleteMany(),
    prisma.season.deleteMany(),
    prisma.bannedWord.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const boysSeason = await prisma.season.create({
    data: {
      yearMonth: '2026-02',
      division: Division.boys,
      displayName: 'טורניר כדורגל רמדאן 2026',
      scoringMode: ScoringMode.football,
      isActive: true,
    },
  });

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
  console.log(`Admin user: ${adminUsername}`);

  const teamsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf-8'));
  for (const team of teamsData) {
    await prisma.team.create({
      data: {
        id: team.id,
        seasonId: boysSeason.id,
        name: team.name,
        logoUrl: team.logo || null,
        status: 'active',
        players: {
          create: team.members.map((member: any) => {
            const nameParts = (member.name || '').split(' ');
            const firstName = nameParts[0] || member.nickname || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            return {
              memberId: member.id,
              firstName,
              lastName,
              nickname: member.nickname || '',
              number: member.number,
              position: member.position || '',
              isCaptain: member.is_captain || false,
              headPhoto: member.head_photo || null,
              bio: member.bio || '',
            };
          }),
        },
      },
    });
  }
  console.log(`Teams: ${teamsData.length}`);

  const matchesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'matches.json'), 'utf-8'));
  const matchIds = new Set(matchesData.map((m: { id: number }) => m.id));
  for (const match of matchesData) {
    await prisma.match.create({
      data: {
        id: match.id,
        seasonId: boysSeason.id,
        date: parseJerusalemDate(match.date),
        location: match.location,
        phase: (match.phase as MatchPhase) || 'group',
        team1Id: match.team1_id,
        team2Id: match.team2_id,
        score1: match.score1,
        score2: match.score2,
        goals: {
          create: (match.goals || []).map((g: any) => ({
            memberId: g.member_id ?? g.memberId,
            minute: g.minute ?? null,
            isOwnGoal: g.is_own_goal || false,
          })),
        },
      },
    });
  }
  console.log(`Matches: ${matchesData.length}`);

  if (fs.existsSync(path.join(dataDir, 'news.json'))) {
    const newsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'news.json'), 'utf-8'));
    for (const item of newsData) {
      await prisma.news.create({
        data: {
          id: item.id,
          seasonId: boysSeason.id,
          title: item.title,
          message: item.message,
          date: parseJerusalemDate(item.date),
          priority: (item.priority as NewsPriority) || 'normal',
        },
      });
    }
    console.log(`News: ${newsData.length}`);
  }

  if (fs.existsSync(path.join(dataDir, 'bracket.json'))) {
    const bracket = JSON.parse(fs.readFileSync(path.join(dataDir, 'bracket.json'), 'utf-8'));
    const slots: any[] = [
      ...(bracket.winners_bracket || []),
      ...(bracket.losers_bracket || []),
      ...(bracket.consolation_bracket || []),
    ];
    let order = 0;
    let linked = 0;
    for (const slot of slots) {
      const matchId =
        slot.match_id != null && matchIds.has(slot.match_id) ? slot.match_id : null;
      if (matchId !== null) linked++;
      await prisma.bracketSlot.create({
        data: {
          seasonId: boysSeason.id,
          slotKey: `match-${slot.match_id}`,
          round: slot.round,
          slotOrder: order++,
          matchId,
          team1Id: slot.team1_id ?? null,
          team2Id: slot.team2_id ?? null,
        },
      });
    }
    console.log(`Bracket slots: ${slots.length} (${linked} linked to matches)`);
  }

  const bannedSeed = ['spam', 'test'];
  for (const word of bannedSeed) {
    await prisma.bannedWord.create({ data: { word: word.toLowerCase(), language: 'en' } });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
