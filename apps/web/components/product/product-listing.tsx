'use client';

import { useFacetsQuery, useProductFeedQuery } from '@marketbd/api-client';
import { PRODUCT_SORTS, type ProductCard, type ProductListQuery, type ProductSort } from '@marketbd/shared';
import { ChevronDown, PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { useI18n, Button, cn, EmptyState, ErrorState, Stars } from '@marketbd/ui';
import { ProductGrid } from './product-card';

type Fixed = Pick<ProductListQuery, 'category' | 'campaign' | 'seller'>;

const PAGE_SIZE = 20;
/** Options shown per filter group before "View more". */
const COLLAPSED = 6;

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

/** One sidebar block: heading + body, separated by a hairline like the reference layout. */
function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-100 py-4 first:pt-0 last:border-0">
      <h3 className="mb-3 text-[15px] font-semibold capitalize text-ink-900">{title}</h3>
      {children}
    </section>
  );
}

/** Checkbox list that collapses to a few rows with a "View more / View less" toggle. */
function CheckList({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: string; label: string; count?: number }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Selected options always stay visible, even when they sit below the fold.
  const shown = open ? options : options.filter((o, i) => i < COLLAPSED || selected.includes(o.value));
  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((o) => (
          <li key={o.value}>
            <label className="flex cursor-pointer items-center gap-2.5 text-ink-700 hover:text-primary-700">
              <input type="checkbox" className="size-4 rounded accent-primary-700" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.count !== undefined && <span className="text-xs text-ink-400">({o.count})</span>}
            </label>
          </li>
        ))}
      </ul>
      {options.length > COLLAPSED && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
          {open ? 'View less' : 'View more'} <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
        </button>
      )}
    </div>
  );
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
    <div className="text-sm">
      {facets && facets.brands.length > 0 && (
        <FilterGroup title="Brands">
          <CheckList
            options={facets.brands.map((b) => ({ value: b.slug, label: b.name, count: b.count }))}
            selected={selectedBrands}
            onToggle={(v) => toggleList('brand', v)}
          />
        </FilterGroup>
      )}

      <FilterGroup title={t.listing.price}>
        <form
          className="flex items-center gap-2"
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
          <input className="input h-9 min-w-0 px-2" inputMode="numeric" placeholder={t.listing.min} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label={t.listing.min} />
          <span className="text-ink-400">–</span>
          <input className="input h-9 min-w-0 px-2" inputMode="numeric" placeholder={t.listing.max} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label={t.listing.max} />
          <Button type="submit" size="sm" className="h-9 shrink-0 px-3" aria-label={t.common.apply}>
            Go
          </Button>
        </form>
        {facets && facets.priceRange.max > 0 && (
          <p className="mt-2 text-xs text-ink-400">
            {money(facets.priceRange.min)} – {money(facets.priceRange.max)}
          </p>
        )}
      </FilterGroup>

      <FilterGroup title={t.listing.rating}>
        <ul className="space-y-1">
          {[5, 4, 3, 2, 1].map((r) => {
            const on = params.rating === r;
            return (
              <li key={r}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((p) => (on ? p.delete('rating') : p.set('rating', String(r))))}
                  className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-ink-50', on && 'bg-primary-50')}
                >
                  <Stars value={r} size={15} />
                  {r < 5 && <span className={cn('text-xs', on ? 'font-semibold text-primary-700' : 'text-ink-500')}>And Up</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 text-ink-700">
          <input
            type="checkbox"
            className="size-4 accent-primary-700"
            checked={Boolean(params.inStock)}
            onChange={(e) => update((p) => (e.target.checked ? p.set('inStock', 'true') : p.delete('inStock')))}
          />
          {t.listing.inStockOnly}
        </label>
      </FilterGroup>

      {facets &&
        Object.entries(facets.attributes)
          .filter(([, values]) => values.length > 1)
          .map(([key, values]) => (
            <FilterGroup key={key} title={key}>
              <CheckList
                options={values.map((v) => ({ value: `${key}:${v}`, label: v }))}
                selected={selectedAttrs}
                onToggle={(v) => toggleList('attrs', v)}
              />
            </FilterGroup>
          ))}
    </div>
  );
}

export function ProductListing({
  fixed = {},
  title,
  label,
  initial,
}: {
  fixed?: Fixed;
  title?: ReactNode;
  /** Shown as "N items found for '<label>'". */
  label?: string;
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
  const clearAll = () => router.push(pathname + (params.q ? `?q=${encodeURIComponent(params.q)}` : ''), { scroll: false });

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

  const found = label ?? params.q;

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-lg bg-white p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{t.listing.filters}</h2>
            {chips.length > 0 && (
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-accent-600 hover:underline">
                {t.common.clearAll}
              </button>
            )}
          </div>
          <FilterPanel fixed={fixed} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            {title}
            <p className="mt-0.5 text-sm text-ink-500">
              <b className="text-ink-800">{total.toLocaleString()}</b> {t.listing.results}
              {found && (
                <>
                  {' '}for <span className="font-semibold text-primary-700">“{found}”</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={() => setDrawer(true)} className="flex h-9 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 text-sm lg:hidden">
            <SlidersHorizontal className="size-4" /> {t.listing.filters}
            {chips.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary-700 text-[10px] font-bold text-white">{chips.length}</span>}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-ink-500 sm:inline">Sort By:</span>
            <select
              className="input h-9 w-auto min-w-40 bg-white font-medium"
              value={params.sort}
              onChange={(e) => setParam('sort', e.target.value === 'relevance' ? null : e.target.value)}
            >
              {PRODUCT_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.listing.sort[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chips.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-500">{t.listing.filteredBy}:</span>
            {chips.map((c) => (
              <button key={c.label} type="button" onClick={c.remove} className="flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-primary-800 hover:bg-primary-100">
                {c.label} <X className="size-3" />
              </button>
            ))}
            <button type="button" onClick={clearAll} className="font-semibold text-accent-600 hover:underline">
              {t.common.clearAll}
            </button>
          </div>
        )}

        {isError ? (
          <ErrorState message={t.common.error} onRetry={() => void refetch()} />
        ) : !isFetching && items.length === 0 ? (
          <div className="card">
            <EmptyState icon={<PackageSearch />} title={t.listing.noResults} text={t.listing.noResultsHint} />
          </div>
        ) : (
          <ProductGrid products={items} loading={isFetching} skeletons={page === 1 ? 8 : 4} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        )}

        {hasMore && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => setPage((data?.meta.page ?? 1) + 1)} loading={isFetching} className="min-w-48 bg-white">
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
