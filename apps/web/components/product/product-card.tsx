'use client';

import { useAddToCart, useCountdown } from '@marketbd/api-client';
import type { ProductCard as ProductCardData } from '@marketbd/shared';
import { ArrowDown, BadgeCheck, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useI18n, Skeleton } from '@marketbd/ui';

/** Listing card: image with discount + rating badges, title, price, and a full-width Add to Cart button. */
export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const { add, isLoading } = useAddToCart();
  const verified = product.seller !== null;

  const onAdd = async () => {
    const v = product.defaultVariant;
    // Products with options need a choice on the product page.
    if (!v || product.variantCount > 1) {
      router.push(`/p/${product.slug}`);
      return;
    }
    const ok = await add(product, {
      id: v.id,
      sku: v.sku,
      attributes: v.attributes,
      price: product.flash ? (product.compareAtPrice ?? product.price) : product.price,
      compareAtPrice: product.compareAtPrice,
      stock: v.stock,
      isActive: true,
      flash: product.flash,
    });
    if (ok) toast.success(t.product.added);
    else toast.error(t.common.error);
  };

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg bg-white transition hover:shadow-raised">
      <Link href={`/p/${product.slug}`} className="relative block aspect-square overflow-hidden bg-ink-50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 210px"
            className="object-cover transition duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : null}
        {product.flash ? (
          <span className="absolute left-0 top-2 rounded-r bg-flash px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Flash</span>
        ) : null}
        {product.ratingCount > 0 && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-ink-800 shadow-sm">
            {product.ratingAvg.toFixed(1)}
            <Star className="size-2.5 fill-warning text-warning" />
            <span className="font-normal text-ink-500">{product.ratingCount}</span>
          </span>
        )}
        {!product.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-semibold text-white">{t.common.outOfStock}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-2">
        <Link href={`/p/${product.slug}`} className="line-clamp-2 min-h-[2.5rem] text-[12.5px] leading-5 text-ink-800 hover:text-primary-700">
          {verified && (
            <span className="mr-1 inline-flex -translate-y-px items-center gap-0.5 rounded bg-primary-50 px-1 text-[9px] font-bold uppercase text-primary-700">
              <BadgeCheck className="size-2.5" /> {product.seller?.isHouseStore ? 'Official' : 'Verified'}
            </span>
          )}
          {pick(product.title, product.titleBn)}
        </Link>
        <div className="flex flex-wrap items-center gap-x-1.5 text-[12px]">
          {product.discountPercent > 0 && (
            <span className="flex items-center font-semibold text-success">
              <ArrowDown className="size-3" />
              {product.discountPercent}%
            </span>
          )}
          {product.compareAtPrice && <span className="text-ink-400 line-through">{money(product.compareAtPrice)}</span>}
          <span className="text-sm font-bold text-accent-600">{money(product.price)}</span>
        </div>
        {product.soldCount > 0 && (
          <p className="text-[10px] text-ink-400">
            {product.soldCount.toLocaleString()} {t.common.sold}
          </p>
        )}
        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={!product.inStock || isLoading}
          className="mt-auto h-8 w-full rounded-md bg-primary-50 text-xs font-semibold text-primary-800 transition hover:bg-primary-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {product.inStock ? t.product.addToCart : t.common.outOfStock}
        </button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-white">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-2">
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-8" />
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  loading = false,
  skeletons = 12,
  cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
}: {
  products: ProductCardData[];
  loading?: boolean;
  skeletons?: number;
  cols?: string;
}) {
  return (
    <div className={`grid gap-2.5 md:gap-3 ${cols}`}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 6} />
      ))}
      {loading && Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={`s${i}`} />)}
    </div>
  );
}

export function Countdown({ endsAt, compact = false }: { endsAt: string; compact?: boolean }) {
  const { hours, minutes, seconds, days } = useCountdown(endsAt);
  const totalHours = days * 24 + hours;
  const cell = compact
    ? 'min-w-6 rounded bg-ink-900 px-1 py-0.5 text-center text-xs font-bold text-white tabular-nums'
    : 'min-w-8 rounded-md bg-ink-900 px-1.5 py-1 text-center text-sm font-bold text-white tabular-nums';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="inline-flex items-center gap-1 font-bold text-ink-900" role="timer" aria-live="off">
      <span className={cell}>{pad(totalHours)}</span>:<span className={cell}>{pad(minutes)}</span>:<span className={cell}>{pad(seconds)}</span>
    </span>
  );
}
