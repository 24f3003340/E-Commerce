'use client';

import { useRecentlyViewed } from '@/lib/recentlyViewed';
import { ProductRail } from './ProductRail';

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const { items } = useRecentlyViewed();
  const visible = items.filter((p) => p.id !== excludeId);
  if (visible.length < 2) return null;
  return <ProductRail title="Recently Viewed" products={visible} />;
}
