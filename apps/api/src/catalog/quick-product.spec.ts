import { buildQuickProduct, parseBulkRow, splitList } from './quick-product';

const base = { name: 'Cotton Kurta', categoryId: 'c1', price: 59900, colors: ['Black', 'White'], sizes: ['S', 'M'], stock: 7, images: ['https://x/a.jpg'], publish: true };
const ctx = { prefix: 'ACM', categoryName: 'Kurtas', storeName: 'Acme Store', code: 'AB12' };

describe('buildQuickProduct', () => {
  it('generates a variant per colour × size with unique SKUs and the entered stock', () => {
    const dto = buildQuickProduct(base, ctx);
    expect(dto.variants).toHaveLength(4);
    expect(new Set(dto.variants.map((v) => v.sku)).size).toBe(4);
    expect(dto.variants[0]).toMatchObject({ sku: 'ACM-AB12-BLA-S', color: 'Black', size: 'S', price: 59900, mrp: 59900, stock: 7 });
    expect(dto.variants[0].colorHex).toBe('#111111');
  });

  it('writes a description, tags and publishes only when there is a photo', () => {
    const dto = buildQuickProduct(base, ctx);
    expect(dto.description).toContain('Cotton Kurta');
    expect(dto.tags).toEqual(expect.arrayContaining(['cotton', 'kurta', 'kurtas']));
    expect(dto.status).toBe('ACTIVE');
    expect(buildQuickProduct({ ...base, images: [] }, ctx).status).toBe('DRAFT');
    expect(buildQuickProduct({ ...base, publish: false }, ctx).status).toBe('DRAFT');
  });

  it('handles products without sizes or colours', () => {
    const dto = buildQuickProduct({ ...base, colors: [], sizes: [] }, ctx);
    expect(dto.variants).toHaveLength(1);
    expect(dto.variants[0].sku).toBe('ACM-AB12');
  });

  it('never lets the MRP fall below the price', () => {
    expect(buildQuickProduct({ ...base, mrp: 1000 }, ctx).variants[0].mrp).toBe(59900);
  });
});

describe('parseBulkRow', () => {
  const cats = [{ id: 'c1', name: 'Kurtas', slug: 'women-kurtas' }];
  it('parses a good row, resolving the category by name or slug', () => {
    const r = parseBulkRow({ name: 'A Kurta', category: 'kurtas', price: '₹599', mrp: '1,199', colors: 'Red|Blue', sizes: 'S|M', stock: '5', images: 'https://x/1.jpg|https://x/2.jpg' }, cats);
    expect(r).toMatchObject({ input: { categoryId: 'c1', price: 59900, mrp: 119900, colors: ['Red', 'Blue'], stock: 5, publish: true } });
    expect('error' in parseBulkRow({ name: 'A Kurta', category: 'women-kurtas', price: '599' }, cats)).toBe(false);
  });
  it('reports what is wrong with a bad row', () => {
    expect(parseBulkRow({ category: 'Kurtas', price: '5' }, cats)).toEqual({ error: 'Product name is missing' });
    expect(parseBulkRow({ name: 'Zz', category: 'Shoes', price: '5' }, cats)).toEqual({ error: 'Category "Shoes" not found' });
    expect(parseBulkRow({ name: 'Zz', category: 'Kurtas', price: 'abc' }, cats)).toEqual({ error: 'Price must be a number above 0' });
    expect(parseBulkRow({ name: 'Zz', category: 'Kurtas', price: '500', mrp: '100' }, cats)).toEqual({ error: 'Price cannot be more than MRP' });
  });
  it('saves a row without photos as a draft', () => {
    const r = parseBulkRow({ name: 'Zz', category: 'Kurtas', price: '500' }, cats);
    expect(r).toMatchObject({ input: { publish: false, images: [] } });
  });
});

describe('splitList', () => {
  it('splits on | , ; and removes blanks and duplicates', () => {
    expect(splitList('S| M ,L;; s')).toEqual(['S', 'M', 'L']);
  });
});
