/**
 * Splits `amount` (paise) across parts in proportion to `weights`. Shares are whole paise and
 * always add up to exactly `amount` (largest-remainder rounding). Used to share one cart's
 * coupon discount, shipping and COD fee between the per-seller orders it becomes.
 */
export function allocate(amount: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return weights.map((_, i) => (i === 0 ? amount : 0));
  const exact = weights.map((w) => (amount * w) / totalWeight);
  const shares = exact.map(Math.floor);
  let left = amount - shares.reduce((s, x) => s + x, 0);
  const byRemainder = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}

/** Groups items by seller (null = the store itself), keeping the order sellers first appear in. */
export function groupBySeller<T>(items: T[], sellerOf: (item: T) => string | null): { sellerId: string | null; items: T[] }[] {
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const key = sellerOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([sellerId, list]) => ({ sellerId, items: list }));
}
