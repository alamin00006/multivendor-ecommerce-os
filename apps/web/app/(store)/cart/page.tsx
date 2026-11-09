'use client';

import {
  guestAllSelected,
  guestItemRemoved,
  guestItemUpdated,
  selectGuestCart,
  useCartQuery,
  useClearUnavailableMutation,
  useIsAuthenticated,
  useMarketplaceMode,
  useRemoveCartItemMutation,
  useSelectAllCartMutation,
  useUpdateCartItemMutation,
} from '@marketbd/api-client';
import type { CartItemView, SellerSummary } from '@marketbd/shared';
import { ShoppingCart, Store, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '@/i18n/client';
import { Badge, Button, ButtonLink, cn, EmptyState, Price, QuantityStepper, Skeleton } from '@/components/ui';

interface Line {
  key: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  variantLabel: string;
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
  slug: i.product.slug,
  title: pick(i.product.title, i.product.titleBn),
  imageUrl: i.product.imageUrl,
  variantLabel: Object.values(i.variant.attributes).join(' / '),
  unitPrice: i.unitPrice,
  compareAtPrice: i.compareAtPrice,
  quantity: i.quantity,
  stock: i.variant.stock,
  selected: i.selected,
  available: i.available,
  reason: i.unavailableReason,
  seller: i.seller,
});

function CartLine({
  line,
  onQty,
  onSelect,
  onRemove,
}: {
  line: Line;
  onQty: (q: number) => void;
  onSelect: (s: boolean) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={cn('flex gap-3 py-4', !line.available && 'opacity-60')}>
      <input
        type="checkbox"
        className="mt-8 size-4 accent-primary-700"
        checked={line.selected && line.available}
        disabled={!line.available}
        onChange={(e) => onSelect(e.target.checked)}
        aria-label={line.title}
      />
      <Link href={`/p/${line.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-ink-50 md:size-24">
        {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="96px" className="object-cover" />}
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm hover:text-primary-700">
          {line.title}
        </Link>
        <p className="text-xs text-ink-500">{line.variantLabel}</p>
        {line.reason && <Badge tone="danger">{line.reason}</Badge>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Price value={line.unitPrice} compareAt={line.compareAtPrice} size="sm" />
          <div className="flex items-center gap-2">
            <QuantityStepper value={line.quantity} max={Math.max(1, Math.min(line.stock, 20))} onChange={onQty} disabled={!line.available && line.stock === 0} />
            <button type="button" onClick={onRemove} className="rounded p-2 text-ink-400 hover:bg-ink-50 hover:text-danger" aria-label={t.cart.remove}>
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const dispatch = useDispatch();
  const authed = useIsAuthenticated();
  const { showSellerInfo } = useMarketplaceMode();
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
        slug: g.slug,
        title: pick(g.title, g.titleBn),
        imageUrl: g.imageUrl,
        variantLabel: g.variantLabel,
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

  // Group by seller (multi-vendor) to mirror how the order will be split into packages.
  const groups = new Map<string, { seller: SellerSummary | null; lines: Line[] }>();
  for (const l of lines) {
    const key = showSellerInfo && l.seller ? l.seller.id : 'all';
    const g = groups.get(key) ?? { seller: showSellerInfo ? l.seller : null, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  }

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
      <div className="container-site pt-6">
        <div className="card">
          <EmptyState icon={<ShoppingCart />} title={t.cart.empty} text={t.cart.emptyHint} action={<ButtonLink href="/">{t.checkout.continueShopping}</ButtonLink>} />
        </div>
      </div>
    );
  }

  return (
    <div className="container-site grid gap-4 pt-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="card flex items-center justify-between p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-primary-700" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
            {t.cart.selectAll} ({lines.length})
          </label>
          {unavailable > 0 && (
            <Button size="sm" variant="ghost" loading={clearState.isLoading} onClick={() => void clearUnavailable()}>
              {t.cart.removeUnavailable}
            </Button>
          )}
        </div>
        {[...groups.entries()].map(([key, g]) => (
          <div key={key} className="card px-3">
            {g.seller && (
              <Link href={`/shop/${g.seller.slug}`} className="flex items-center gap-2 border-b border-ink-100 py-3 text-sm font-semibold">
                <Store className="size-4 text-primary-700" /> {g.seller.shopName}
              </Link>
            )}
            <div className="divide-y divide-ink-100">
              {g.lines.map((l) => (
                <CartLine key={l.key} line={l} onQty={(q) => onQty(l, q)} onSelect={(s) => onSelect(l, s)} onRemove={() => onRemove(l)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <aside>
        <div className="card sticky top-28 space-y-3 p-4">
          <h2 className="font-semibold">{t.cart.summary}</h2>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500">
              {t.cart.subtotal} ({count} {t.cart.items})
            </span>
            <span className="font-semibold">{money(subtotal)}</span>
          </div>
          {unavailable > 0 && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{t.cart.blocked}</p>}
          <div className="flex justify-between border-t border-ink-100 pt-3">
            <span className="font-semibold">{t.cart.total}</span>
            <span className="text-xl font-bold text-accent-600">{money(subtotal)}</span>
          </div>
          {authed ? (
            <Button block size="lg" variant="accent" disabled={count === 0} onClick={() => router.push('/checkout')}>
              {t.cart.checkout} ({count})
            </Button>
          ) : (
            <>
              <p className="text-xs text-ink-500">{t.cart.signInToCheckout}</p>
              <ButtonLink href="/login?next=/checkout" variant="accent" size="lg" className="w-full">
                {t.common.signIn}
              </ButtonLink>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
