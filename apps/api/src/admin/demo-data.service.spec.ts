import { DemoDataService } from './demo-data.service';

function setup(opts: { archivedProducts?: string[]; usedCoupons?: string[] } = {}) {
  const coupons = [
    { id: 'c-unused', isActive: true },
    { id: 'c-used', isActive: true },
  ];
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]) },
    coupon: {
      findMany: jest.fn().mockResolvedValue(coupons),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    couponUsage: { count: jest.fn(({ where }) => Promise.resolve(opts.usedCoupons?.includes(where.couponId) ? 2 : 0)) },
    order: { count: jest.fn().mockResolvedValue(0) },
    banner: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    category: { updateMany: jest.fn().mockResolvedValue({ count: 5 }) },
    setting: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const products = {
    remove: jest.fn((id: string) => Promise.resolve({ ok: true, archived: opts.archivedProducts?.includes(id) ?? false })),
  };
  const cache = { delByPrefix: jest.fn().mockResolvedValue(undefined) };
  const service = new DemoDataService(prisma as never, products as never, cache as never);
  return { service, prisma, products, cache };
}

describe('DemoDataService.remove', () => {
  it('deletes unordered demo products, archives ordered ones and counts both', async () => {
    const { service, products } = setup({ archivedProducts: ['p2'] });
    const result = await service.remove();
    expect(products.remove).toHaveBeenCalledTimes(3);
    expect(result.productsDeleted).toBe(2);
    expect(result.productsArchived).toBe(1);
  });

  it('deletes unused demo coupons but only deactivates the ones customers already used', async () => {
    const { service, prisma } = setup({ usedCoupons: ['c-used'] });
    const result = await service.remove();
    expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 'c-unused' } });
    expect(prisma.coupon.update).toHaveBeenCalledWith({ where: { id: 'c-used' }, data: { isActive: false } });
    expect(prisma.coupon.delete).not.toHaveBeenCalledWith({ where: { id: 'c-used' } });
    expect(result.couponsDeleted).toBe(1);
    expect(result.couponsDeactivated).toBe(1);
  });

  it('only touches records flagged as demo', async () => {
    const { service, prisma } = setup();
    await service.remove();
    expect(prisma.product.findMany.mock.calls[0][0].where.isDemo).toBe(true);
    expect(prisma.coupon.findMany.mock.calls[0][0].where.isDemo).toBe(true);
    expect(prisma.banner.deleteMany).toHaveBeenCalledWith({ where: { isDemo: true } });
  });

  it('records that the demo data was removed so the seed will not recreate it, then clears the cache', async () => {
    const { service, prisma, cache } = setup();
    await service.remove();
    const call = prisma.setting.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: 'demo' });
    expect(typeof call.create.value.removedAt).toBe('string');
    expect(cache.delByPrefix).toHaveBeenCalledWith('catalog:');
  });

  it('does not record the removal when deleting a product fails (so it can be retried)', async () => {
    const { service, prisma, products } = setup();
    products.remove.mockRejectedValueOnce(new Error('db down'));
    await expect(service.remove()).rejects.toThrow('db down');
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });
});
