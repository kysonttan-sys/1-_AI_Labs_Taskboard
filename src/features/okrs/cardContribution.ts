export interface ContributionCard {
  status: string;
  progress: number;
  completedAt: Date | string | null;
}

export interface WeightedLink {
  weight: number;
  card: ContributionCard;
}

export function cardContribution(card: ContributionCard): number {
  if (card.status === 'done' || card.completedAt) return 1;
  if (card.status === 'blocked') return 0;
  const value = typeof card.progress === 'number' ? card.progress / 100 : 0;
  return Math.max(0, Math.min(1, value));
}

export function recomputeKrCurrent(links: WeightedLink[], current: number, target: number): number {
  if (links.length === 0) return current;
  const totalWeight = links.reduce((sum, link) => sum + (link.weight || 1), 0);
  if (totalWeight === 0) return current;
  const weightedContribution = links.reduce(
    (sum, link) => sum + (link.weight || 1) * cardContribution(link.card),
    0
  );
  return Math.min(target, (weightedContribution / totalWeight) * target);
}
