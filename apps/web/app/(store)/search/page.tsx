import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductListing } from '@/components/product/product-listing';
import { getDictionary } from '@/i18n/server';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `“${q}”` : 'Search', robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, { t }] = await Promise.all([searchParams, getDictionary()]);
  return (
    <div className="container-site pt-4">
      <Suspense>
        <ProductListing
          title={
            q ? (
              <h1 className="font-display text-lg font-semibold">
                {t.listing.searchFor} “{q}”
              </h1>
            ) : null
          }
        />
      </Suspense>
    </div>
  );
}
