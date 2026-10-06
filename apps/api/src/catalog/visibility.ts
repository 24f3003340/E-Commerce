import { Prisma, ProductStatus, SellerStatus } from '@prisma/client';

/**
 * A product is on sale when it is ACTIVE and either belongs to the store itself or to an approved
 * marketplace seller (products of pending / suspended sellers stay hidden). Combine it with other
 * conditions through AND so its OR is never overwritten.
 */
export const LIVE_PRODUCT: Prisma.ProductWhereInput = {
  status: ProductStatus.ACTIVE,
  OR: [{ sellerId: null }, { seller: { status: SellerStatus.APPROVED } }],
};

export function liveProduct(extra: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput {
  return { AND: [LIVE_PRODUCT, extra] };
}

export function isLiveProduct(p: { status: ProductStatus; seller?: { status: SellerStatus } | null }): boolean {
  return p.status === ProductStatus.ACTIVE && (!p.seller || p.seller.status === SellerStatus.APPROVED);
}
