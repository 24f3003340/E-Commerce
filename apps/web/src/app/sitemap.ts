import type { MetadataRoute } from 'next';
import { serverGetSafe } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import type { Category } from '@/lib/types';

export const dynamic = 'force-dynamic';

function flatten(tree: Category[]): Category[] {
  return tree.flatMap((c) => [c, ...flatten(c.children)]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    serverGetSafe<Category[]>('/categories', []),
    serverGetSafe<{ slug: string; updatedAt: string }[]>('/products/sitemap', []),
  ]);
  const pages = ['', '/search', '/about', '/contact', '/faq', '/shipping-policy', '/return-policy', '/terms', '/privacy'];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.4 })),
    ...flatten(categories).map((c) => ({ url: `${SITE_URL}/c/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${SITE_URL}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
