'use client';

import { useProductFeedQuery } from '@marketbd/api-client';
import type { BannerView, CategoryNode, FlashSaleView, LinkTargetType, QuickLinkView } from '@marketbd/shared';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Smartphone, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Countdown, ProductGrid } from '@/components/product/product-card';
import { SectionHeader } from '@/components/ui';

/** Maps admin link targets to storefront URLs. */
export const linkHref = (type: LinkTargetType, value: string): string => {
  switch (type) {
    case 'CATEGORY':
      return `/c/${value}`;
    case 'CAMPAIGN':
      return `/campaign/${value}`;
    case 'PRODUCT':
      return `/p/${value}`;
    case 'BRAND':
      return `/search?brand=${encodeURIComponent(value)}`;
    case 'SEARCH':
      return value === 'flash-sale' ? '/flash-sale' : `/search?q=${encodeURIComponent(value)}`;
    case 'EXTERNAL':
      return value;
  }
};

export function HeroSlider({ banners }: { banners: BannerView[] }) {
  const [ref, embla] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000, stopOnInteraction: false })]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla]);
  if (banners.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-lg md:rounded-xl">
      <div ref={ref} className="overflow-hidden">
        <div className="flex">
          {banners.map((b, i) => (
            <Link key={b.id} href={linkHref(b.linkType, b.linkValue)} className="relative aspect-[2/1] min-w-0 flex-[0_0_100%] md:aspect-[10/3]">
              <picture>
                {b.mobileImageUrl && <source media="(max-width: 767px)" srcSet={`/api/v1/images/resize?url=${encodeURIComponent(b.mobileImageUrl)}&width=768`} />}
                <Image src={b.imageUrl} alt={b.title} fill sizes="(max-width: 1200px) 100vw, 1200px" className="object-cover" priority={i === 0} />
              </picture>
            </Link>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => embla?.scrollPrev()}
        className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow md:block"
        aria-label="Previous slide"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => embla?.scrollNext()}
        className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow md:block"
        aria-label="Next slide"
      >
        <ChevronRight className="size-5" />
      </button>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => embla?.scrollTo(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
          />
        ))}
      </div>
    </div>
  );
}

export function QuickLinks({ links }: { links: QuickLinkView[] }) {
  const { pick } = useI18n();
  if (links.length === 0) return null;
  return (
    <div className="scrollbar-none -mx-3 flex gap-3 overflow-x-auto px-3 md:mx-0 md:grid md:grid-cols-8 md:px-0">
      {links.map((l) => (
        <Link key={l.id} href={linkHref(l.linkType, l.linkValue)} className="flex w-16 shrink-0 flex-col items-center gap-1.5 md:w-auto">
          <span className="relative size-14 overflow-hidden rounded-2xl bg-white shadow-card md:size-16">
            <Image src={l.iconUrl} alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="line-clamp-2 text-center text-xs text-ink-700">{pick(l.label, l.labelBn)}</span>
        </Link>
      ))}
    </div>
  );
}

export function MidBanners({ banners }: { banners: BannerView[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {banners.map((b) => (
        <Link key={b.id} href={linkHref(b.linkType, b.linkValue)} className="relative aspect-[4/1] overflow-hidden rounded-lg">
          <Image src={b.imageUrl} alt={b.title} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
        </Link>
      ))}
    </div>
  );
}

export function FlashSaleSection({ sale }: { sale: FlashSaleView | null }) {
  const { t, money, pick } = useI18n();
  if (!sale || sale.items.length === 0) return null;
  return (
    <section className="card p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-flash md:text-xl">
            <Zap className="size-5 fill-flash" /> {t.home.flashSale}
          </h2>
          <span className="hidden text-sm text-ink-500 sm:inline">{t.home.endsIn}</span>
          <Countdown endsAt={sale.endAt} />
        </div>
        <Link href="/flash-sale" className="rounded border border-flash px-3 py-1 text-sm font-semibold text-flash hover:bg-red-50">
          {t.common.seeAll}
        </Link>
      </div>
      <div className="scrollbar-none -mx-3 flex gap-2.5 overflow-x-auto px-3 md:mx-0 md:grid md:grid-cols-6 md:px-0">
        {sale.items.slice(0, 12).map((item) => {
          const pct = Math.min(100, Math.round((item.soldCount / item.stockLimit) * 100));
          const left = item.stockLimit - item.soldCount;
          const off = Math.round(((item.regularPrice - item.specialPrice) / item.regularPrice) * 100);
          return (
            <Link
              key={item.id}
              href={`/p/${item.product.slug}`}
              className="group w-36 shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-white md:w-auto"
            >
              <div className="relative aspect-square bg-ink-50">
                {item.product.imageUrl && (
                  <Image src={item.product.imageUrl} alt={item.product.title} fill sizes="200px" className="object-cover transition group-hover:scale-105" />
                )}
                <span className="absolute left-0 top-2 rounded-r bg-flash px-1.5 py-0.5 text-xs font-bold text-white">-{off}%</span>
              </div>
              <div className="space-y-1 p-2">
                <p className="line-clamp-1 text-xs text-ink-700">{pick(item.product.title, item.product.titleBn)}</p>
                <p className="font-bold text-flash">{money(item.specialPrice)}</p>
                <p className="text-[11px] text-ink-400 line-through">{money(item.regularPrice)}</p>
                <div className="relative h-4 overflow-hidden rounded-full bg-red-100">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-flash" style={{ width: `${pct}%` }} />
                  <span className="relative block text-center text-[10px] font-semibold leading-4 text-ink-900">
                    {left <= 5 ? t.common.limitedStock : `${item.soldCount} ${t.common.sold}`}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function CategoryGrid({ categories }: { categories: CategoryNode[] }) {
  const { t, pick } = useI18n();
  if (categories.length === 0) return null;
  return (
    <section>
      <SectionHeader title={t.home.recommendedCategories} href="/categories" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
        {categories.map((c) => (
          <Link key={c.id} href={`/c/${c.slug}`} className="flex flex-col items-center gap-2 rounded-lg bg-white p-2 shadow-card transition hover:shadow-raised md:p-3">
            <span className="relative aspect-square w-full overflow-hidden rounded-md bg-ink-50">
              {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="(max-width: 768px) 25vw, 140px" className="object-cover" />}
            </span>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-ink-700 md:text-xs">{pick(c.name, c.nameBn)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** "Deals for you" infinite feed (IntersectionObserver + RTK Query merge). */
export function DealsFeed() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, isFetching, isError, refetch } = useProductFeedQuery({ page, limit: 24, sort: 'popular' });
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = data ? data.meta.page < data.meta.totalPages : true;

  const loadMore = useCallback(() => {
    if (!isFetching && hasMore && data) setPage(data.meta.page + 1);
  }, [isFetching, hasMore, data]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <section>
      <SectionHeader title={t.home.dealsForYou} />
      <ProductGrid products={data?.items ?? []} loading={isFetching} skeletons={data ? 6 : 12} />
      <div ref={sentinel} className="py-6 text-center text-sm text-ink-500">
        {isError ? (
          <button type="button" onClick={() => void refetch()} className="font-semibold text-primary-700">
            {t.common.retry}
          </button>
        ) : !hasMore ? (
          t.common.nothingMore
        ) : null}
      </div>
    </section>
  );
}

export function AppDownloadBlock() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-primary-800 to-primary-600 p-6 text-white md:flex-row md:p-8">
      <Smartphone className="size-14 shrink-0 text-primary-100" />
      <div className="flex-1 text-center md:text-left">
        <h2 className="font-display text-xl font-bold">{t.home.appTitle}</h2>
        <p className="mt-1 text-sm text-primary-100">{t.home.appText}</p>
      </div>
      <div className="flex gap-2">
        <span className="rounded-md bg-black px-4 py-2 text-xs font-semibold">App Store</span>
        <span className="rounded-md bg-black px-4 py-2 text-xs font-semibold">Google Play</span>
      </div>
    </section>
  );
}
