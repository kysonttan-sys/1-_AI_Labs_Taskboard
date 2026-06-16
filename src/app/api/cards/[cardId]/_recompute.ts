import { prisma } from '@/lib/db/client';
import { cardContribution } from '@/features/okrs/cardContribution';

export async function recomputeLinkedKeyResults(cardId: string) {
  const links = await prisma.cardKeyResult.findMany({
    where: { cardId },
    include: { keyResult: true },
  });

  for (const link of links) {
    const krLinks = await prisma.cardKeyResult.findMany({
      where: { keyResultId: link.keyResultId },
      include: { card: true },
    });
    const totalWeight = krLinks.reduce((sum, l) => sum + l.weight, 0);
    if (totalWeight === 0) continue;
    const weighted = krLinks.reduce(
      (sum, l) => sum + l.weight * cardContribution(l.card),
      0
    );
    const nextCurrent = Math.min(
      link.keyResult.target,
      (weighted / totalWeight) * link.keyResult.target
    );
    await prisma.keyResult.update({
      where: { id: link.keyResultId },
      data: { current: nextCurrent },
    });
  }
}
