import type { PrismaClient } from '@prisma/client';

/** Delete all tournament data in FK-safe order. */
export async function wipeDatabase(prisma: PrismaClient): Promise<void> {
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
}
