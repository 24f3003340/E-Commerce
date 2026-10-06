import { csv, istDateStamp, paginate, slugify } from './utils';

describe('utils', () => {
  it('slugifies names', () => {
    expect(slugify('Men → T-Shirts & Polos!')).toBe('men-t-shirts-polos');
  });

  it('uses the IST calendar date for order numbers', () => {
    // 20:00 UTC on 5 Oct is 01:30 IST on 6 Oct
    expect(istDateStamp(new Date('2026-10-05T20:00:00Z'))).toBe('20261006');
    expect(istDateStamp(new Date('2026-10-05T10:00:00Z'))).toBe('20261005');
  });

  it('clamps pagination', () => {
    expect(paginate(0, 1000)).toEqual({ page: 1, limit: 100, skip: 0, take: 100 });
    expect(paginate(3, 20)).toMatchObject({ skip: 40, take: 20 });
  });

  it('parses comma separated filters', () => {
    expect(csv('S, M,,L')).toEqual(['S', 'M', 'L']);
    expect(csv(undefined)).toEqual([]);
  });
});
