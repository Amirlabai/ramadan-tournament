/**
 * One-shot: clear legacy auto-applied Google CDN URLs from users.avatar_url
 * so profile shows placeholder until upload or explicit Google opt-in.
 *
 * Run: npx tsx src/scripts/cleanup-non-upload-user-avatars.ts
 */
import { prisma } from '../lib/prisma';

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      avatarUrl: { not: null },
      NOT: { avatarUrl: { startsWith: '/uploads/' } },
    },
    data: { avatarUrl: null },
  });

  console.log(JSON.stringify({ clearedNonUploadAvatars: result.count }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
