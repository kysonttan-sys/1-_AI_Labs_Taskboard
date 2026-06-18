import { prisma } from '@/lib/db/client';
import { cardContribution } from '@/features/okrs/cardContribution';

export async function recomputeLinkedKeyResults(cardId: string) {
  // Find every key result linked to this card.
  const directLinks = await prisma.cardKeyResult.findMany({
    where: { cardId },
    select: { keyResultId: true },
  });

  const keyResultIds = Array.from(new Set(directLinks.map((l) => l.keyResultId)));
  if (keyResultIds.length === 0) return;

  // Load all links for all affected key results in a single query.
  const allLinks = await prisma.cardKeyResult.findMany({
    where: { keyResultId: { in: keyResultIds } },
    include: { card: true, keyResult: true },
  });

  // Group links by keyResultId.
  const byKeyResult: Record<string, typeof allLinks> = {};
  for (const link of allLinks) {
    const arr = byKeyResult[link.keyResultId];
    if (arr) {
      arr.push(link);
    } else {
      byKeyResult[link.keyResultId] = [link];
    }
  }

  const updates: { id: string; current: number }[] = [];
  for (const keyResultId of Object.keys(byKeyResult)) {
    const krLinks = byKeyResult[keyResultId];
    if (!krLinks || krLinks.length === 0) continue;
    const totalWeight = krLinks.reduce((sum: number, l) => sum + l.weight, 0);
    if (totalWeight === 0) continue;
    const weighted = krLinks.reduce(
      (sum: number, l: (typeof allLinks)[number]) => sum + l.weight * cardContribution(l.card),
      0
    );
    const target = krLinks[0].keyResult.target;
    const nextCurrent = Math.min(target, (weighted / totalWeight) * target);
    updates.push({ id: keyResultId, current: nextCurrent });
  }

  if (updates.length === 0) return;

  // Batch-update all affected key results inside a transaction.
  await prisma.$transaction(
    updates.map((u) =>
      prisma.keyResult.update({
        where: { id: u.id },
        data: { current: u.current },
      })
    )
  );
}
