'use client';

import { useFacetsQuery, useProductFeedQuery } from '@marketbd/api-client';
import { PRODUCT_SORTS, type ProductCard, type ProductListQuery, type ProductSort } from '@marketbd/shared';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Button, cn, EmptyState, ErrorState, Stars } from '@/components/ui';
import { ProductGrid } from './product-card';

type Fixed = Pick<ProductListQuery, 'category' | 'campaign' | 'seller'>;

const PAGE_SIZE = 20;

/** Reads list params from the URL so filters are shareable and survive refresh. */
function useListParams(fixed: Fixed) {
  const sp = useSearchParams();
  return useMemo(() => {
    const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
    const sort = sp.get('sort') as ProductSort | null;
    return {
      ...fixed,
      q: sp.get('q') ?? undefined,
      brand: sp.get('brand') ?? undefined,
      attrs: sp.get('attrs') ?? undefined,
      minPrice: num('minPrice'),
      maxPrice: num('maxPrice'),
      rating: num('rating'),
      inStock: sp.get('inStock') === 'true' ? true : undefined,
      sort: sort && (PRODUCT_SORTS as readonly string[]).includes(sort) ? sort : ('relevance' as ProductSort),
    };
  }, [sp, fixed]);
}

function FilterPanel({ fixed, onDone }: { fixed: Fixed; onDone?: () => void }) {
  const { t, money } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const params = useListParams(fixed);
  const { data: facets } = useFacetsQuery({ category: fixed.category, campaign: fixed.campaign, seller: fixed.seller, q: params.q });
  const [min, setMin] = useState(params.minPrice ? String(params.minPrice / 100) : '');
  const [max, setMax] = useState(params.maxPrice ? String(params.maxPrice / 100) : '');

  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp.toString());
    mutate(next);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
    onDone?.();
  };
  const toggleList = (key: 'brand' | 'attrs', value: string) =>
    update((p) => {
      const list = (p.get(key) ?? '').split(',').filter(Boolean);
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      if (next.length) p.set(key, next.join(','));
      else p.delete(key);
    });
  const selectedBrands = (params.brand ?? '').split(',').filter(Boolean);
  const selectedAttrs = (params.attrs ?? '').split(',').filter(Boolean);

  return (
    <div className="space-y-5 text-sm">
      {facets && facets.brands.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-ink-900">{t.listing.brand}</h3>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {facets.brands.map((b) => (
              <li key={b.slug}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="accent-primary-700" checked={selectedBrands.includes(b.slug)} onChange={() => toggleList('brand', b.slug)} />
                  <span className="flex-1">{b.name}</span>
                  <span className="text-xs text-ink-400">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 font-semibold text-ink-900">{t.listing.price}</h3>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            update((p) => {
              if (min) p.set('minPrice', String(Math.round(Number(min) * 100)));
              else p.delete('minPrice');
              if (max) p.set('maxPrice', String(Math.round(Number(max) * 100)));
              else p.delete('maxPrice');
            });
          }}
        >
          <input className="input h-8 px-2" inputMode="numeric" placeholder={t.listing.min} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label={t.listing.min} />
          <span>–</span>
          <input className="input h-8 px-2" inputMode="numeric" placeholder={t.listing.max} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label={t.listing.max} />
          <Button type="submit" size="sm">
            {t.common.apply}
          </Button>
        </form>
        {facets && facets.priceRange.max > 0 && (
          <p className="mt-1 text-xs text-ink-400">
            {money(facets.priceRange.min)} – {money(facets.priceRange.max)}
          </p>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-semibold text-ink-900">{t.listing.rating}</h3>
        <ul className="space-y-1.5">
          {[4, 3, 2].map((r) => (
            <li key={r}>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="rating"
                  className="accent-primary-700"
                  checked={params.rating === r}
                  onChange={() => update((p) => p.set('rating', String(r)))}
                />
                <Stars value={r} /> <span className="text-xs text-ink-500">{t.listing.andUp}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="accent-primary-700"
          checked={Boolean(params.inStock)}
          onChange={(e) => update((p) => (e.target.checked ? p.set('inStock', 'true') : p.delete('inStock')))}
        />
        {t.listing.inStockOnly}
      </label>
      {facets &&
        Object.entries(facets.attributes)
          .filter(([, values]) => values.length > 1)
          .map(([key, values]) => (
            <section key={key}>
              <h3 className="mb-2 font-semibold capitalize text-ink-900">{key}</h3>
              <div className="flex flex-wrap gap-1.5">
                {values.slice(0, 20).map((v) => {
                  const token = `${key}:${v}`;
                  const on = selectedAttrs.includes(token);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleList('attrs', token)}
                      className={cn('rounded border px-2 py-1 text-xs', on ? 'border-primary-700 bg-primary-50 text-primary-800' : 'border-ink-200')}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
    </div>
  );
}

export function ProductListing({
  fixed = {},
  title,
  initial,
}: {
  fixed?: Fixed;
  title?: ReactNode;
  initial?: { items: ProductCard[]; total: number };
}) {
  const { t, money } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const params = useListParams(fixed);
  // Page resets to 1 whenever the filters in the URL change.
  const filterKey = sp.toString();
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (next: number | ((p: number) => number)) =>
    setPaging((s) => ({ key: filterKey, page: typeof next === 'function' ? next(s.page) : next }));
  const [drawer, setDrawer] = useState(false);
  const query = { ...params, page, limit: PAGE_SIZE };
  const { data, isFetching, isError, refetch } = useProductFeedQuery(query);

  const usingInitial = !data && initial && !sp.toString();
  const items = data?.items ?? (usingInitial ? initial.items : []);
  const total = data?.meta.total ?? (usingInitial ? initial.total : 0);
  const hasMore = data ? data.meta.page < data.meta.totalPages : false;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setPage(1);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const chips: Array<{ label: string; remove: () => void }> = [];
  for (const b of (params.brand ?? '').split(',').filter(Boolean)) {
    chips.push({ label: b, remove: () => setParam('brand', (params.brand ?? '').split(',').filter((x) => x !== b).join(',') || null) });
  }
  for (const a of (params.attrs ?? '').split(',').filter(Boolean)) {
    chips.push({ label: a.replace(':', ': '), remove: () => setParam('attrs', (params.attrs ?? '').split(',').filter((x) => x !== a).join(',') || null) });
  }
  if (params.minPrice || params.maxPrice) {
    chips.push({
      label: `${money(params.minPrice ?? 0)} – ${params.maxPrice ? money(params.maxPrice) : '∞'}`,
      remove: () => {
        const next = new URLSearchParams(sp.toString());
        next.delete('minPrice');
        next.delete('maxPrice');
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      },
    });
  }
  if (params.rating) chips.push({ label: `${params.rating}★ ${t.listing.andUp}`, remove: () => setParam('rating', null) });
  if (params.inStock) chips.push({ label: t.listing.inStockOnly, remove: () => setParam('inStock', null) });

  return (
    <div className="flex gap-5">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="card sticky top-28 p-4">
          <h2 className="mb-4 font-semibold">{t.listing.filters}</h2>
          <FilterPanel fixed={fixed} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="card mb-3 flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            {title}
            <p className="text-sm text-ink-500">
              {total.toLocaleString()} {t.listing.results}
            </p>
          </div>
          <button type="button" onClick={() => setDrawer(true)} className="flex items-center gap-1 rounded border border-ink-200 px-3 py-1.5 text-sm lg:hidden">
            <SlidersHorizontal className="size-4" /> {t.listing.filters}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-ink-500 sm:inline">{t.listing.sortBy}</span>
            <select className="input h-9 w-auto" value={params.sort} onChange={(e) => setParam('sort', e.target.value === 'relevance' ? null : e.target.value)}>
              {PRODUCT_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.listing.sort[s]}
                </option>
              ))}
            </select>
          </label>
          {chips.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-ink-100 pt-3 text-xs">
              <span className="text-ink-500">{t.listing.filteredBy}:</span>
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={c.remove} className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-primary-800">
                  {c.label} <X className="size-3" />
                </button>
              ))}
              <button type="button" onClick={() => router.push(pathname + (params.q ? `?q=${encodeURIComponent(params.q)}` : ''))} className="font-semibold text-accent-600">
                {t.common.clearAll}
              </button>
            </div>
          )}
        </div>

        {isError ? (
          <ErrorState message={t.common.error} onRetry={() => void refetch()} />
        ) : !isFetching && items.length === 0 ? (
          <div className="card">
            <EmptyState icon={<PackageSearch />} title={t.listing.noResults} text={t.listing.noResultsHint} />
          </div>
        ) : (
          <ProductGrid products={items} loading={isFetching} skeletons={page === 1 ? 10 : 5} cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" />
        )}

        {hasMore && (
          <div className="mt-5 text-center">
            <Button variant="outline" onClick={() => setPage((data?.meta.page ?? 1) + 1)} loading={isFetching} className="min-w-48">
              {t.common.loadMore}
            </Button>
          </div>
        )}
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-y-0 right-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{t.listing.filters}</h2>
              <button type="button" onClick={() => setDrawer(false)} aria-label={t.common.close}>
                <X className="size-5" />
              </button>
            </div>
            <FilterPanel fixed={fixed} onDone={() => setDrawer(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
