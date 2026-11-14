'use client';

import { useProductFeedQuery } from '@marketbd/api-client';
import type { BannerView, CategoryNode, FlashSaleView, LinkTargetType, QuickLinkView } from '@marketbd/shared';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fill } from '@/i18n';
import { useI18n, SectionHeader } from '@marketbd/ui';
import { Countdown, ProductGrid } from '@/components/product/product-card';

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
        className="absolute bottom-3 right-14 hidden rounded-full bg-white/80 p-1.5 shadow md:block"
        aria-label="Previous slide"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => embla?.scrollNext()}
        className="absolute bottom-3 right-4 hidden rounded-full bg-white/80 p-1.5 shadow md:block"
        aria-label="Next slide"
      >
        <ChevronRight className="size-4" />
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

/** Quick-link chips: white pill cards with icon + label, one row (scrolls on mobile). */
export function QuickLinks({ links }: { links: QuickLinkView[] }) {
  const { pick } = useI18n();
  if (links.length === 0) return null;
  return (
    <div className="scrollbar-none -mx-3 flex gap-2.5 overflow-x-auto px-3 md:mx-0 md:grid md:grid-cols-6 md:gap-3 md:px-0">
      {links.slice(0, 6).map((l) => (
        <Link
          key={l.id}
          href={linkHref(l.linkType, l.linkValue)}
          className="flex h-14 shrink-0 items-center gap-2.5 rounded-lg bg-white px-3 shadow-card transition hover:shadow-raised md:h-16 md:justify-center"
        >
          <span className="relative size-8 shrink-0 overflow-hidden rounded-md">
            <Image src={l.iconUrl} alt="" fill sizes="32px" className="object-cover" />
          </span>
          <span className="whitespace-nowrap text-sm font-medium text-ink-800">{pick(l.label, l.labelBn)}</span>
        </Link>
      ))}
    </div>
  );
}

/** One full-width campaign banner under the quick links. */
export function MidBanners({ banners }: { banners: BannerView[] }) {
  const banner = banners[0];
  if (!banner) return null;
  return (
    <Link href={linkHref(banner.linkType, banner.linkValue)} className="relative block aspect-[3/1] overflow-hidden rounded-lg md:aspect-[5/1]">
      <Image src={banner.imageUrl} alt={banner.title} fill sizes="(max-width: 1200px) 100vw, 1200px" className="object-cover" />
    </Link>
  );
}

/** Full-width tinted band: flash-sale intro box on the left, deals scrolling on the right. */
export function FlashSaleSection({ sale }: { sale: FlashSaleView | null }) {
  const { t, money, pick } = useI18n();
  if (!sale || sale.items.length === 0) return null;
  const maxOff = Math.max(...sale.items.map((i) => Math.round(((i.regularPrice - i.specialPrice) / i.regularPrice) * 100)));
  return (
    <section className="bg-gradient-to-b from-primary-50 to-primary-100/60 py-4">
      <div className="container-site flex gap-3">
        <div className="flex w-36 shrink-0 flex-col items-center justify-between gap-2 rounded-lg bg-white p-3 text-center shadow-card md:w-48 md:p-4">
          <div>
            <p className="font-display text-2xl font-extrabold italic leading-none text-flash md:text-3xl">
              <Zap className="mb-1 inline size-6 fill-warning text-warning" />
              {t.home.flashSale}
            </p>
            <span className="mt-2 inline-block rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-800">
              {fill(t.home.upToOff, { n: maxOff })}
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-ink-600">{t.home.dontMiss}</p>
            <Countdown endsAt={sale.endAt} compact />
          </div>
          <Link
            href="/flash-sale"
            className="flex w-full items-center justify-center gap-1 rounded-md bg-primary-700 py-1.5 text-xs font-semibold text-white hover:bg-primary-800"
          >
            {t.common.seeAll} <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <div className="scrollbar-none flex min-w-0 flex-1 gap-2.5 overflow-x-auto">
          {sale.items.map((item) => {
            const pct = Math.min(100, Math.round((item.soldCount / item.stockLimit) * 100));
            const left = item.stockLimit - item.soldCount;
            const off = Math.round(((item.regularPrice - item.specialPrice) / item.regularPrice) * 100);
            return (
              <Link
                key={item.id}
                href={`/p/${item.product.slug}`}
                className="group w-36 shrink-0 overflow-hidden rounded-lg bg-white md:w-[calc((100%-4*0.625rem)/5)]"
              >
                <div className="relative aspect-square bg-ink-50">
                  {item.product.imageUrl && (
                    <Image src={item.product.imageUrl} alt={item.product.title} fill sizes="200px" className="object-cover transition group-hover:scale-105" />
                  )}
                  <span className="absolute left-2 top-2 rounded bg-flash px-1.5 py-0.5 text-[11px] font-bold text-white">-{off}%</span>
                </div>
                <div className="space-y-0.5 p-2">
                  <p className="line-clamp-1 text-xs text-ink-700">{pick(item.product.title, item.product.titleBn)}</p>
                  <p className="flex items-baseline gap-1.5">
                    <span className="font-bold text-accent-600">{money(item.specialPrice)}</span>
                    <span className="text-[11px] text-ink-400 line-through">{money(item.regularPrice)}</span>
                  </p>
                  <div className="h-1 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-flash" style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-[10px] ${left <= 5 ? 'font-semibold text-flash' : 'text-ink-500'}`}>
                    {left <= 5 ? t.common.limitedStock : `${item.soldCount} ${t.common.sold}`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Recommended categories: one scrollable row of large image tiles with arrow controls. */
export function CategoryGrid({ categories }: { categories: CategoryNode[] }) {
  const { t, pick } = useI18n();
  const row = useRef<HTMLDivElement>(null);
  if (categories.length === 0) return null;
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section>
      <SectionHeader
        title={t.home.recommendedCategories}
        action={
          <div className="hidden gap-1.5 md:flex">
            <button type="button" onClick={() => scroll(-1)} className="rounded-full bg-white p-1.5 shadow-card hover:bg-ink-50" aria-label="Previous">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => scroll(1)} className="rounded-full bg-white p-1.5 shadow-card hover:bg-ink-50" aria-label="Next">
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />
      <div ref={row} className="scrollbar-none -mx-3 flex gap-3 overflow-x-auto scroll-smooth px-3 md:mx-0 md:px-0">
        {categories.map((c) => (
          <Link key={c.id} href={`/c/${c.slug}`} className="group flex w-24 shrink-0 flex-col items-center gap-2 md:w-[calc((100%-7*0.75rem)/8)]">
            <span className="relative aspect-square w-full overflow-hidden rounded-xl bg-white">
              {c.imageUrl && (
                <Image src={c.imageUrl} alt="" fill sizes="(max-width: 768px) 96px, 150px" className="object-cover transition group-hover:scale-105" />
              )}
            </span>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-ink-700 md:text-xs">{pick(c.name, c.nameBn)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Deals grid (6 columns on desktop) with a Load More button. */
export function DealsFeed() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, isFetching, isError, refetch } = useProductFeedQuery({ page, limit: 24, sort: 'popular' });
  const hasMore = data ? data.meta.page < data.meta.totalPages : false;

  return (
    <section>
      <SectionHeader title={t.home.dealsCantMiss} />
      <ProductGrid products={data?.items ?? []} loading={isFetching} skeletons={data ? 6 : 12} />
      <div className="py-6 text-center text-sm text-ink-500">
        {isError ? (
          <button type="button" onClick={() => void refetch()} className="font-semibold text-primary-700">
            {t.common.retry}
          </button>
        ) : hasMore ? (
          <button
            type="button"
            disabled={isFetching}
            onClick={() => data && setPage(data.meta.page + 1)}
            className="rounded-full border border-ink-300 bg-white px-8 py-2.5 text-sm font-semibold text-ink-800 hover:border-primary-700 hover:text-primary-700 disabled:opacity-50"
          >
            {isFetching ? t.common.loading : t.common.loadMore}
          </button>
        ) : data ? (
          t.common.nothingMore
        ) : null}
      </div>
    </section>
  );
}
