import type { CategoryNode, CategoryRef, ProductCard } from '@marketbd/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ProductListing } from '@/components/product/product-listing';
import { getDictionary } from '@/i18n/server';
import { apiGet, apiGetPage } from '@/lib/server-api';

type Category = CategoryNode & { breadcrumbs: CategoryRef[] };

export const revalidate = 120;

const load = (slug: string) =>
  apiGet<Category>(`/categories/${encodeURIComponent(slug)}`, { revalidate: 300, tags: ['categories'] });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = await load((await params).slug);
  if (!category) return {};
  return {
    title: category.name,
    description: `Shop ${category.name} online in Bangladesh — best prices, Cash on Delivery and fast delivery.`,
    alternates: { canonical: `/c/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, { locale }] = await Promise.all([load(slug), getDictionary()]);
  if (!category) notFound();
  const initial = await apiGetPage<ProductCard>(`/products?category=${slug}&limit=20`, { revalidate: 120 });
  const name = (c: { name: string; nameBn: string }) => (locale === 'bn' ? c.nameBn : c.name);

  return (
    <div className="container-site pt-3">
      <Breadcrumbs items={category.breadcrumbs.map((b) => ({ label: name(b), href: `/c/${b.slug}` }))} />
      {category.children.length > 0 && (
        <div className="scrollbar-none mb-3 flex gap-3 overflow-x-auto">
          {category.children.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="card flex shrink-0 items-center gap-2 px-3 py-2 text-sm hover:text-primary-700"
            >
              {c.iconUrl && <Image src={c.iconUrl} alt="" width={28} height={28} className="size-7 rounded" />}
              {name(c)}
            </Link>
          ))}
        </div>
      )}
      <Suspense>
        <ProductListing
          fixed={{ category: slug }}
          title={<h1 className="font-display text-lg font-semibold">{name(category)}</h1>}
          initial={initial ? { items: initial.items, total: initial.meta.total } : undefined}
        />
      </Suspense>
    </div>
  );
}
