'use client';

import {
  guestAllSelected,
  guestItemRemoved,
  guestItemUpdated,
  selectGuestCart,
  useBoughtTogetherQuery,
  useCartQuery,
  useClearUnavailableMutation,
  useIsAuthenticated,
  useMarketplaceMode,
  usePublicSettingsQuery,
  useRelatedProductsQuery,
  useRemoveCartItemMutation,
  useSelectAllCartMutation,
  useUpdateCartItemMutation,
  useWishlistToggle,
} from '@marketbd/api-client';
import type { CartItemView, SellerSummary } from '@marketbd/shared';
import { BadgeCheck, Heart, Info, ShoppingCart, Store, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { useHydrated, useI18n, Badge, Button, ButtonLink, cn, EmptyState, QuantityStepper, Skeleton } from '@marketbd/ui';
import { DealsFeed } from '@/components/home/home-sections';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ProductRow } from '@/components/product/product-row';
import { useRecentlyViewed } from '@/lib/recently-viewed';

interface Line {
  key: string;
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  attributes: string[];
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  stock: number;
  selected: boolean;
  available: boolean;
  reason: string | null;
  seller: SellerSummary | null;
}

const fromServer = (i: CartItemView, pick: (a: string, b: string | null) => string): Line => ({
  key: i.id,
  productId: i.product.id,
  slug: i.product.slug,
  title: pick(i.product.title, i.product.titleBn),
  imageUrl: i.product.imageUrl,
  attributes: Object.entries(i.variant.attributes).map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}-${v}`),
  unitPrice: i.unitPrice,
  compareAtPrice: i.compareAtPrice,
  quantity: i.quantity,
  stock: i.variant.stock,
  selected: i.selected,
  available: i.available,
  reason: i.unavailableReason,
  seller: i.seller,
});

function SaveButton({ line }: { line: Line }) {
  const router = useRouter();
  const wishlist = useWishlistToggle(line.productId);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!wishlist.authed) return router.push('/login?next=/cart');
        await wishlist.toggle();
      }}
      className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-accent-600"
      aria-label="Save to wishlist"
      aria-pressed={wishlist.saved}
    >
      <Heart className={cn('size-4', wishlist.saved && 'fill-accent-500 text-accent-500')} />
    </button>
  );
}

function CartLine({
  line,
  showSeller,
  onQty,
  onSelect,
  onRemove,
}: {
  line: Line;
  showSeller: boolean;
  onQty: (q: number) => void;
  onSelect: (s: boolean) => void;
  onRemove: () => void;
}) {
  const { t, money } = useI18n();
  const similar = line.title.split(/\s+/).slice(0, 3).join(' ');
  return (
    <div className={cn('flex gap-3 py-3', !line.available && 'opacity-60')}>
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0 accent-primary-700"
        checked={line.selected && line.available}
        disabled={!line.available}
        onChange={(e) => onSelect(e.target.checked)}
        aria-label={line.title}
      />
      <Link href={`/p/${line.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md border border-ink-100 bg-ink-50 md:size-24">
        {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="96px" className="object-cover" />}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm font-medium text-ink-800 hover:text-primary-700">
          {line.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          {line.attributes.length > 0 && <span>• {line.attributes.join(', ')}</span>}
          {showSeller && line.seller && <span className="text-success">Fulfilled by {line.seller.isHouseStore ? 'MarketBD' : 'Seller'}</span>}
        </div>
        {line.reason && <Badge tone="danger">{line.reason}</Badge>}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <QuantityStepper value={line.quantity} max={Math.max(1, Math.min(line.stock, 20))} onChange={onQty} disabled={!line.available && line.stock === 0} />
          <Link
            href={`/search?q=${encodeURIComponent(similar)}`}
            className="rounded-full border border-accent-200 px-2.5 py-1 text-[11px] font-medium text-accent-600 hover:bg-accent-50"
          >
            More items like this
          </Link>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <div className="text-right">
          <p className="text-base font-bold text-accent-600">{money(line.unitPrice * line.quantity)}</p>
          {line.compareAtPrice && line.compareAtPrice > line.unitPrice && (
            <p className="text-xs text-ink-400 line-through">{money(line.compareAtPrice * line.quantity)}</p>
          )}
        </div>
        <div className="flex items-center">
          <button type="button" onClick={onRemove} className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-danger" aria-label={t.cart.remove}>
            <Trash2 className="size-4" />
          </button>
          <SaveButton line={line} />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1 text-ink-600">
        {label}
        {hint && (
          <span title={hint} className="cursor-help text-primary-600">
            <Info className="size-3.5" />
          </span>
        )}
      </span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}

/** "Recently viewed" + "Pair with your cart" + endless deals, shown under the cart like the reference layout. */
function CartSuggestions({ lines }: { lines: Line[] }) {
  const first = lines[0]?.slug ?? '';
  const inCart = lines.map((l) => l.productId);
  const recent = useRecentlyViewed();
  const { data: together } = useBoughtTogetherQuery(first, { skip: !first });
  const { data: related } = useRelatedProductsQuery(first, { skip: !first });
  const pair = (together?.length ? together : (related ?? [])).filter((p) => !inCart.includes(p.id));
  return (
    <div className="mt-6 space-y-6">
      <ProductRow title="Recently viewed product" products={recent} perRow={6} card />
      <ProductRow title="Pair with your cart" products={pair} perRow={6} card />
      <DealsFeed />
    </div>
  );
}

export default function CartPage() {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const dispatch = useDispatch();
  const authed = useIsAuthenticated();
  const { showSellerInfo } = useMarketplaceMode();
  const { data: settingsData } = usePublicSettingsQuery();
  const settings = useHydrated() ? settingsData : undefined;
  const guest = useSelector(selectGuestCart);
  const { data, isLoading } = useCartQuery(undefined, { skip: !authed });
  const [update] = useUpdateCartItemMutation();
  const [remove] = useRemoveCartItemMutation();
  const [selectAll] = useSelectAllCartMutation();
  const [clearUnavailable, clearState] = useClearUnavailableMutation();

  const lines: Line[] = authed
    ? (data?.items ?? []).map((i) => fromServer(i, pick))
    : guest.map((g) => ({
        key: g.variantId,
        productId: g.productId,
        slug: g.slug,
        title: pick(g.title, g.titleBn),
        imageUrl: g.imageUrl,
        attributes: g.variantLabel && g.variantLabel !== 'Default' ? [g.variantLabel] : [],
        unitPrice: g.unitPrice,
        compareAtPrice: g.compareAtPrice,
        quantity: g.quantity,
        stock: g.stock,
        selected: g.selected,
        available: true,
        reason: null,
        seller: null,
      }));

  const payable = lines.filter((l) => l.selected && l.available);
  const subtotal = authed ? (data?.summary.subtotal ?? 0) : payable.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const count = payable.reduce((n, l) => n + l.quantity, 0);
  const unavailable = lines.filter((l) => !l.available).length;
  const allSelected = lines.length > 0 && lines.filter((l) => l.available).every((l) => l.selected);

  const onQty = (l: Line, q: number) =>
    authed ? void update({ id: l.key, quantity: q }) : dispatch(guestItemUpdated({ variantId: l.key, quantity: q }));
  const onSelect = (l: Line, s: boolean) =>
    authed ? void update({ id: l.key, selected: s }) : dispatch(guestItemUpdated({ variantId: l.key, selected: s }));
  const onRemove = (l: Line) => (authed ? void remove(l.key) : dispatch(guestItemRemoved(l.key)));
  const onSelectAll = (s: boolean) => (authed ? void selectAll(s) : dispatch(guestAllSelected(s)));
  const removeSelected = () => {
    if (!payable.length || !confirm(`Remove ${payable.length} selected item(s) from your cart?`)) return;
    for (const l of payable) onRemove(l);
  };

  // Group by seller (multi-vendor) to mirror how the order will be split into packages.
  const groups = new Map<string, { seller: SellerSummary | null; lines: Line[] }>();
  for (const l of lines) {
    const key = showSellerInfo && l.seller ? l.seller.id : 'all';
    const g = groups.get(key) ?? { seller: showSellerInfo ? l.seller : null, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  }
  // One delivery fee per package that has something selected; the address decides the final rate at checkout.
  const packages = [...groups.values()].filter((g) => g.lines.some((l) => l.selected && l.available)).length;
  const deliveryEstimate = settings ? packages * settings.shipping.insideDhaka : 0;

  if (authed && isLoading) {
    return (
      <div className="container-site space-y-3 pt-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container-site pt-3">
        <Breadcrumbs items={[{ label: t.common.cart }]} />
        <div className="card">
          <EmptyState icon={<ShoppingCart />} title={t.cart.empty} text={t.cart.emptyHint} action={<ButtonLink href="/">{t.checkout.continueShopping}</ButtonLink>} />
        </div>
        <CartSuggestions lines={[]} />
      </div>
    );
  }

  return (
    <div className="container-site pt-3">
      <Breadcrumbs items={[{ label: t.common.cart }]} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <h1 className="font-semibold text-ink-900">Order items ({lines.length})</h1>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary-700" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
              {t.cart.selectAll} ({lines.length})
            </label>
            <div className="ml-auto flex items-center gap-2">
              {unavailable > 0 && (
                <Button size="sm" variant="ghost" loading={clearState.isLoading} onClick={() => void clearUnavailable()}>
                  {t.cart.removeUnavailable}
                </Button>
              )}
              <button
                type="button"
                disabled={!payable.length}
                onClick={removeSelected}
                className="flex items-center gap-1 text-xs text-ink-500 hover:text-danger disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> {t.common.delete}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {[...groups.entries()].map(([key, g]) => {
              const groupSelectable = g.lines.filter((l) => l.available);
              const groupAll = groupSelectable.length > 0 && groupSelectable.every((l) => l.selected);
              return (
                <div key={key} className="overflow-hidden rounded-lg border border-primary-100 bg-primary-50/40">
                  <div className="flex items-center gap-2 border-b border-primary-100 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary-700"
                      checked={groupAll}
                      onChange={(e) => groupSelectable.forEach((l) => onSelect(l, e.target.checked))}
                      aria-label="Select all from this shop"
                    />
                    {g.seller ? (
                      <Link href={`/shop/${g.seller.slug}`} className="flex items-center gap-1.5 font-semibold hover:text-primary-700">
                        <Store className="size-4 text-primary-700" /> {g.seller.shopName}
                        {g.seller.isHouseStore && (
                          <span className="flex items-center gap-0.5 rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                            <BadgeCheck className="size-3" /> Official store
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="font-semibold">{t.cart.title}</span>
                    )}
                    <span className="ml-auto text-xs text-ink-500">{g.lines.length} {g.lines.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className="divide-y divide-ink-100 bg-white px-3">
                    {g.lines.map((l) => (
                      <CartLine
                        key={l.key}
                        line={l}
                        showSeller={showSellerInfo}
                        onQty={(q) => onQty(l, q)}
                        onSelect={(s) => onSelect(l, s)}
                        onRemove={() => onRemove(l)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium text-success">Standard Delivery</span>
                    {settings && (
                      <span className="text-ink-500">
                        Inside Dhaka {settings.shipping.insideDhakaEta} · Outside {settings.shipping.outsideDhakaEta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="lg:sticky lg:top-32">
          <div className="card space-y-3 p-4">
            <h2 className="border-b border-ink-100 pb-2 text-sm font-semibold">Order summary:</h2>
            <SummaryRow label={`Product price (${count})`} value={money(subtotal)} />
            <SummaryRow
              label="Delivery fee"
              value={packages ? money(deliveryEstimate) : money(0)}
              hint="Inside Dhaka rate per package. The final fee depends on your delivery address."
            />
            {unavailable > 0 && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{t.cart.blocked}</p>}
            <div className="flex items-center justify-between border-t border-ink-100 pt-3">
              <span className="text-sm text-ink-600">Total payment:</span>
              <span className="text-xl font-bold text-ink-900">{money(subtotal + deliveryEstimate)}</span>
            </div>
            <button
              type="button"
              disabled={count === 0}
              onClick={() => router.push(authed ? '/checkout' : '/login?next=/checkout')}
              className="h-11 w-full rounded-full bg-gradient-to-r from-primary-700 to-accent-500 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authed ? `Checkout (${count})` : 'Sign in to checkout'}
            </button>
            {!authed && <p className="text-center text-xs text-ink-500">{t.cart.signInToCheckout}</p>}
          </div>
        </aside>
      </div>

      <CartSuggestions lines={lines} />
    </div>
  );
}
