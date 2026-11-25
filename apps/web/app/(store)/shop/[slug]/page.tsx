import type { ShopView } from '@marketbd/shared';
import { BadgeCheck, Star, Store } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductListing } from '@/components/product/product-listing';
import { ShopBar, ShopChatButton, ShopSection } from '@/components/shop/shop-parts';
import { apiGet, getMultiVendor } from '@/lib/server-api';

export const revalidate = 120;

const load = (slug: string) => apiGet<ShopView>(`/shops/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await load((await params).slug);
  return shop ? { title: shop.shopName, description: shop.description ?? undefined } : {};
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-5 ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-white/40 text-white/60'}`} />
      ))}
    </span>
  );
}

/** Shop page: banner header, then a "Homepage" (curated rows) and an "All Products" tab. */
export default async function ShopPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, { tab }] = await Promise.all([params, searchParams]);
  if (!(await getMultiVendor())) notFound();
  const shop = await load(slug);
  if (!shop) notFound();
  const allProducts = tab === 'products';
  const tabClass = (on: boolean) => `flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold sm:flex-none ${on ? 'bg-primary-700 text-white' : 'bg-white text-ink-600 shadow-card hover:text-primary-700'}`;

  return (
    <div className="container-site space-y-4 pt-3">
      {/* Header: banner with logo, name, rating and chat */}
      <div className="relative overflow-hidden rounded-lg bg-primary-800">
        {shop.bannerUrl && <Image src={shop.bannerUrl} alt="" fill priority sizes="1200px" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" aria-hidden />
        <div className="relative flex min-h-36 items-center justify-between gap-4 p-4 md:min-h-40 md:p-5">
          <div className="flex items-center gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-white md:size-24">
              {shop.logoUrl ? (
                <Image src={shop.logoUrl} alt={shop.shopName} fill sizes="96px" className="object-cover" />
              ) : (
                <Store className="m-auto mt-6 size-10 text-ink-300" />
              )}
            </div>
            <div className="text-white">
              <h1 className="flex items-center gap-1.5 font-display text-2xl font-bold drop-shadow md:text-3xl">
                {shop.shopName}
                {shop.isHouseStore && <BadgeCheck className="size-6" aria-label="Official store" />}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <Stars value={shop.ratingAvg} />
              </div>
              <p className="mt-0.5 text-lg font-semibold drop-shadow">
                {shop.reviewCount.toLocaleString('en-US')} Reviews <span className="text-sm font-normal text-white/80">· {shop.productCount} products</span>
              </p>
            </div>
          </div>
          <ShopChatButton slug={shop.slug} />
        </div>
      </div>

      <nav className="flex gap-2" aria-label="Shop sections">
        <Link href={`/shop/${shop.slug}`} className={tabClass(!allProducts)} aria-current={!allProducts ? 'page' : undefined}>
          Homepage
        </Link>
        <Link href={`/shop/${shop.slug}?tab=products`} className={tabClass(allProducts)} aria-current={allProducts ? 'page' : undefined}>
          All Products
        </Link>
      </nav>

      {allProducts ? (
        <div className="space-y-3">
          <ShopBar title="All Products" />
          <Suspense>
            <ProductListing fixed={{ seller: slug }} />
          </Suspense>
        </div>
      ) : (
        <div className="space-y-5">
          {shop.bannerUrl && (
            <div className="relative aspect-[16/5] overflow-hidden rounded-lg">
              <Image src={shop.bannerUrl} alt={`${shop.shopName} banner`} fill sizes="1200px" className="object-cover" />
            </div>
          )}
          {shop.description && <p className="card p-4 text-sm leading-relaxed text-ink-700">{shop.description}</p>}
          <ShopSection slug={slug} title="Featured Products" sort="popular" />
          <ShopSection slug={slug} title="New Arrivals" sort="newest" />
          <ShopSection slug={slug} title="Top Rated" sort="rating" />
          <div className="text-center">
            <Link href={`/shop/${shop.slug}?tab=products`} className="inline-block rounded-full border border-ink-300 bg-white px-8 py-2.5 text-sm font-semibold text-ink-800 hover:border-primary-700 hover:text-primary-700">
              See all {shop.productCount} products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
