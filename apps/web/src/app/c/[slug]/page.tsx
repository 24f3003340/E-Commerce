import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductListing, type SearchParams } from '@/components/ProductListing';
import { Breadcrumbs } from '@/components/ui';
import { serverGet } from '@/lib/server';

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  breadcrumbs: { name: string; slug: string }[];
  children: { id: string; name: string; slug: string }[];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await serverGet<CategoryInfo>(`/categories/${slug}`);
  return { title: category.breadcrumbs.map((b) => b.name).join(' ') };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const category = await serverGet<CategoryInfo>(`/categories/${slug}`);
  const crumbs = category.breadcrumbs.map((b, i) => ({
    label: b.name,
    href: i < category.breadcrumbs.length - 1 ? `/c/${b.slug}` : undefined,
  }));
  return (
    <div className="container py-4">
      <Breadcrumbs items={crumbs} />
      {category.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="chip border-gray-300 hover:border-gray-900">
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <ProductListing searchParams={await searchParams} category={slug} title={category.breadcrumbs.map((b) => b.name).join(' → ')} />
    </div>
  );
}
