/**
 * One-shot: clear roster head_photo that is not under /uploads/ (e.g. Google CDN),
 * and promote leftover pending_head_photo to head when head is empty, else wipe pending.
 *
 * Run: npx tsx src/scripts/cleanup-non-upload-heads.ts
 */
import { prisma } from '../lib/prisma';
import { invalidateDivisionCaches } from '../services/registrationHelpers';

async function main() {
  const all = await prisma.player.findMany({
    select: { memberId: true, headPhoto: true, pendingHeadPhoto: true, seasonId: true },
  });

  let clearedGoogle = 0;
  let promotedPending = 0;
  let wipedPending = 0;
  const seasonIds = new Set<string>();

  for (const p of all) {
    const head = (p.headPhoto || '').trim();
    const pending = (p.pendingHeadPhoto || '').trim();
    let nextHead = head;
    let nextPending = pending;
    let changed = false;

    if (head && !head.startsWith('/uploads/')) {
      nextHead = '';
      clearedGoogle += 1;
      changed = true;
    }

    if (pending) {
      if (!nextHead && pending.startsWith('/uploads/')) {
        nextHead = pending;
        nextPending = '';
        promotedPending += 1;
        changed = true;
      } else {
        nextPending = '';
        wipedPending += 1;
        changed = true;
      }
    }

    if (changed) {
      await prisma.player.update({
        where: { memberId: p.memberId },
        data: { headPhoto: nextHead, pendingHeadPhoto: nextPending },
      });
      seasonIds.add(p.seasonId);
    }
  }

  const divisions = new Set<string>();
  for (const seasonId of seasonIds) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { division: true },
    });
    if (season) {
      await invalidateDivisionCaches(season.division);
      divisions.add(season.division);
    }
  }

  console.log(
    JSON.stringify(
      {
        total: all.length,
        clearedGoogle,
        promotedPending,
        wipedPending,
        seasonsTouched: seasonIds.size,
        divisionsInvalidated: [...divisions],
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
