'use client';

import { useCountdown } from '@marketbd/api-client';
import type { ProductCard as ProductCardData } from '@marketbd/shared';
import { BadgeCheck, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { Skeleton, Stars } from '@/components/ui';

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const { t, money, pick } = useI18n();
  const flashLeft = product.flash ? product.flash.stockLimit - product.flash.soldCount : null;
  const limited = flashLeft !== null && flashLeft <= Math.max(5, product.flash!.stockLimit * 0.2);
  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
            className="object-cover transition duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : null}
        {product.discountPercent > 0 && (
          <span className="absolute left-0 top-2 rounded-r bg-accent-500 px-1.5 py-0.5 text-xs font-bold text-white">
            -{product.discountPercent}%
          </span>
        )}
        {product.flash && (
          <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded bg-flash px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
            <Zap className="size-3 fill-white" /> Flash
          </span>
        )}
        {!product.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-semibold text-white">
            {t.common.outOfStock}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-ink-800">
          {product.seller && !product.seller.isHouseStore ? null : (
            <BadgeCheck className="mr-1 inline size-4 -translate-y-px text-primary-600" aria-label="Official" />
          )}
          {pick(product.title, product.titleBn)}
        </h3>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-bold text-accent-600">{money(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-xs text-ink-400 line-through">{money(product.compareAtPrice)}</span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-1 text-[11px] text-ink-500">
          {product.ratingCount > 0 ? (
            <span className="flex items-center gap-1">
              <Stars value={product.ratingAvg} size={11} />({product.ratingCount})
            </span>
          ) : (
            <span />
          )}
          {limited ? (
            <span className="font-semibold text-flash">{t.common.limitedStock}</span>
          ) : product.soldCount > 0 ? (
            <span>
              {product.soldCount.toLocaleString()} {t.common.sold}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-card">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-2.5">
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
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
    ? 'min-w-6 rounded bg-flash px-1 py-0.5 text-center text-xs font-bold text-white tabular-nums'
    : 'min-w-8 rounded bg-flash px-1.5 py-1 text-center text-sm font-bold text-white tabular-nums';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="inline-flex items-center gap-1" role="timer" aria-live="off">
      <span className={cell}>{pad(totalHours)}</span>:<span className={cell}>{pad(minutes)}</span>:
      <span className={cell}>{pad(seconds)}</span>
    </span>
  );
}
