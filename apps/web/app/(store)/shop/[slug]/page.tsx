import type { ShopView } from '@marketbd/shared';
import { BadgeCheck, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductListing } from '@/components/product/product-listing';
import { apiGet, getMultiVendor } from '@/lib/server-api';

export const revalidate = 120;

const load = (slug: string) => apiGet<ShopView>(`/shops/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await load((await params).slug);
  return shop ? { title: shop.shopName, description: shop.description ?? undefined } : {};
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getMultiVendor())) notFound();
  const shop = await load(slug);
  if (!shop) notFound();
  return (
    <div className="container-site space-y-4 pt-3">
      <div className="card overflow-hidden">
        <div className="relative h-28 bg-primary-100 md:h-44">
          {shop.bannerUrl && <Image src={shop.bannerUrl} alt="" fill priority sizes="1200px" className="object-cover" />}
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className="relative -mt-12 size-20 overflow-hidden rounded-xl border-4 border-white bg-white shadow">
            {shop.logoUrl && <Image src={shop.logoUrl} alt={shop.shopName} fill sizes="80px" className="object-cover" />}
          </div>
          <div>
            <h1 className="flex items-center gap-1.5 font-display text-xl font-bold">
              {shop.shopName}
              {shop.isHouseStore && <BadgeCheck className="size-5 text-primary-600" />}
            </h1>
            <p className="flex items-center gap-3 text-sm text-ink-500">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-warning text-warning" /> {shop.ratingAvg.toFixed(1)}
              </span>
              <span>{shop.productCount} products</span>
            </p>
          </div>
        </div>
        {shop.description && <p className="border-t border-ink-100 px-4 py-3 text-sm text-ink-600">{shop.description}</p>}
      </div>
      <Suspense>
        <ProductListing fixed={{ seller: slug }} />
      </Suspense>
    </div>
  );
}
