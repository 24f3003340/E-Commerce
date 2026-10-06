import { allocate, groupBySeller } from './split';

describe('allocate', () => {
  it('shares proportionally and always sums to the amount', () => {
    expect(allocate(10000, [50000, 50000])).toEqual([5000, 5000]);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    const shares = allocate(7900, [129900, 49900, 2500]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(7900);
    expect(shares[0]).toBeGreaterThan(shares[1]);
  });

  it('handles zero amounts and weights', () => {
    expect(allocate(0, [10, 20])).toEqual([0, 0]);
    expect(allocate(4900, [0, 0])).toEqual([4900, 0]);
    expect(allocate(4900, [])).toEqual([]);
    expect(allocate(4900, [12345])).toEqual([4900]);
  });
});

describe('groupBySeller', () => {
  it('keeps first-seen order and puts store items under null', () => {
    const groups = groupBySeller(
      [
        { id: 1, s: 'a' },
        { id: 2, s: null },
        { id: 3, s: 'a' },
      ],
      (x) => x.s,
    );
    expect(groups.map((g) => [g.sellerId, g.items.map((i) => i.id)])).toEqual([
      ['a', [1, 3]],
      [null, [2]],
    ]);
  });
});
