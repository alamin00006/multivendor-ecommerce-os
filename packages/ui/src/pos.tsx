'use client';

import {
  errorMessage,
  usePosProductsQuery,
  usePosReceiptQuery,
  usePosSellMutation,
  useSellerPosProductsQuery,
  useSellerPosReceiptQuery,
  useSellerPosSellMutation,
} from '@marketbd/api-client';
import { fromPoisha, type PosProduct, type PosSaleResult, type PosVariant, toPoisha } from '@marketbd/shared';
import { ArrowLeft, Banknote, Barcode, ImageOff, Minus, PackageSearch, Plus, Printer, Receipt, Search, ShoppingCart, Trash2, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from './i18n';
import { PageHeader } from './manage/panel';
import { Badge, Button, cn, EmptyState, ErrorState, Modal, Skeleton, Spinner } from './primitives';
import { RequireAuth } from './require-auth';

export type PosScope = 'admin' | 'seller';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

/** Counter-sale receipt, sized for an 80 mm thermal printer (also fine on A4). */
export function PosReceipt({ sale }: { sale: PosSaleResult }) {
  const { money } = useI18n();
  const { order, shop } = sale;
  const items = order.subOrders.flatMap((s) => s.items);
  const customerName = sale.customer?.name ?? order.shippingAddress.fullName;
  const customerPhone = sale.customer?.phone ?? order.shippingAddress.phone;
  const row = 'flex justify-between gap-3';

  return (
    <div className="pos-receipt mx-auto w-full max-w-[320px] bg-white font-mono text-[12px] leading-snug text-ink-900">
      <div className="text-center">
        <p className="font-display text-lg font-bold">{shop.name}</p>
        {shop.address && <p>{shop.address}</p>}
        {shop.phone && <p>{shop.phone}</p>}
      </div>
      <hr className="my-2 border-dashed border-ink-400" />
      <div className="space-y-0.5">
        <p className={row}><span>Receipt</span><span className="font-semibold">{order.orderNumber}</span></p>
        <p className={row}><span>Date</span><span>{dateTime(order.createdAt)}</span></p>
        <p className={row}><span>Cashier</span><span>{sale.cashier}</span></p>
        <p className={row}><span>Customer</span><span className="text-right">{customerName}{customerPhone ? ` · ${customerPhone}` : ''}</span></p>
      </div>
      <hr className="my-2 border-dashed border-ink-400" />
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <p className="font-semibold">{i.title}</p>
            <p className={`${row} text-ink-600`}>
              <span>
                {i.variantLabel !== 'Default' ? `${i.variantLabel} · ` : ''}
                {i.quantity} × {money(i.unitPrice)}
              </span>
              <span className="text-ink-900">{money(i.lineTotal)}</span>
            </p>
          </li>
        ))}
      </ul>
      <hr className="my-2 border-dashed border-ink-400" />
      <div className="space-y-0.5">
        <p className={row}><span>Subtotal</span><span>{money(order.subtotal)}</span></p>
        {order.discount > 0 && <p className={row}><span>Discount</span><span>−{money(order.discount)}</span></p>}
        <p className={`${row} text-[14px] font-bold`}><span>TOTAL</span><span>{money(order.total)}</span></p>
        <p className={row}><span>Paid (cash)</span><span>{money(sale.cashReceived)}</span></p>
        <p className={`${row} font-semibold`}><span>Change</span><span>{money(sale.change)}</span></p>
      </div>
      {order.note && (
        <>
          <hr className="my-2 border-dashed border-ink-400" />
          <p>Note: {order.note}</p>
        </>
      )}
      <hr className="my-2 border-dashed border-ink-400" />
      <p className="text-center">Thank you for shopping with {shop.name}!</p>
      <p className="text-center text-ink-500">Keep this receipt for exchanges.</p>
    </div>
  );
}

// ───── Receipt page (/receipt/:id) ─────

function ReceiptView({ scope, backHref }: { scope: PosScope; backHref: string }) {
  const { id } = useParams<{ id: string }>();
  const autoPrint = useSearchParams().get('print') === '1';
  const admin = usePosReceiptQuery(id, { skip: scope !== 'admin' });
  const seller = useSellerPosReceiptQuery(id, { skip: scope !== 'seller' });
  const { data, isError, refetch } = scope === 'admin' ? admin : seller;

  useEffect(() => {
    if (!data || !autoPrint) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [data, autoPrint]);

  if (isError) return <ErrorState message="Counter sale not found" onRetry={() => void refetch()} />;
  if (!data) return <Spinner className="mx-auto mt-20" />;
  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[320px] justify-between gap-2 print:hidden">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
          <ArrowLeft className="size-4" /> Back to POS
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>
      <div className="mx-auto max-w-[360px] rounded-lg bg-white p-5 shadow-card print:max-w-none print:p-0 print:shadow-none">
        <PosReceipt sale={data} />
      </div>
    </>
  );
}

/** Printable receipt for a counter sale (?print=1 opens the print dialog). Render outside the panel layout. */
export function PosReceiptPage({ scope, backHref }: { scope: PosScope; backHref: string }) {
  return (
    <RequireAuth roles={[scope === 'admin' ? 'ADMIN' : 'SELLER']}>
      <style>{'@page { size: 80mm auto; margin: 4mm; } @media print { body { background: #fff !important; } }'}</style>
      <main className="min-h-dvh bg-canvas p-4 print:bg-white print:p-0">
        <Suspense fallback={<Spinner className="mx-auto mt-20" />}>
          <ReceiptView scope={scope} backHref={backHref} />
        </Suspense>
      </main>
    </RequireAuth>
  );
}

// ───── Counter ─────

interface Line {
  product: Pick<PosProduct, 'id' | 'title' | 'imageUrl'>;
  variant: PosVariant;
  quantity: number;
}

/** Taka text box → poisha (blank / invalid = 0). */
const taka = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? toPoisha(n) : 0;
};

/** Note-friendly amounts at or above the total: exact, then the next 100 / 500 / 1000. */
const quickCash = (total: number) => {
  const t = fromPoisha(total);
  const ups = [100, 500, 1000].map((step) => Math.ceil(t / step) * step).filter((v) => v > t);
  return [...new Set([t, ...ups])].slice(0, 4);
};

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn('rounded-md bg-ink-50 object-cover', className)} />
  ) : (
    <span className={cn('flex items-center justify-center rounded-md bg-ink-50 text-ink-300', className)}>
      <ImageOff className="size-5" />
    </span>
  );
}

function ProductCard({ product, inCart, onAdd }: { product: PosProduct; inCart: (variantId: string) => number; onAdd: (v: PosVariant) => void }) {
  const { money } = useI18n();
  const single = product.variants.length === 1 ? product.variants[0] : undefined;
  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
  if (single) {
    const left = single.stock - inCart(single.id);
    return (
      <button type="button" onClick={() => onAdd(single)} disabled={left <= 0} aria-label={`Add ${product.title}`} className="card p-2.5 text-left transition hover:border-primary-300 hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-60">
        <Thumb src={product.imageUrl} className="aspect-square w-full" />
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink-900">{product.title}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-bold text-accent-600">{money(single.price)}</span>
          <span className={cn('text-xs', left > 0 ? 'text-ink-500' : 'text-danger')}>{left > 0 ? `${left} in stock` : 'Out of stock'}</span>
        </div>
      </button>
    );
  }
  return (
    <div className="card p-2.5">
      <Thumb src={product.imageUrl} className="aspect-square w-full" />
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink-900">{product.title}</p>
      <p className="mt-1 text-xs text-ink-500">
        {product.variants.length} options · {totalStock} in stock
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {product.variants.map((v) => {
          const left = v.stock - inCart(v.id);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onAdd(v)}
              disabled={left <= 0}
              title={`${v.sku} · ${left} in stock`}
              className="rounded-md border border-ink-200 px-2 py-1 text-left text-xs hover:border-primary-500 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block font-medium">{v.label}</span>
              <span className="text-accent-600">{money(v.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Point of sale counter. Admin sells the house store's stock; a seller sells their own shop's stock.
 * Cash only for now. `salesHref` lists earlier counter sales.
 */
export function PosTerminal({ scope, salesHref, description }: { scope: PosScope; salesHref: string; description: string }) {
  const { money } = useI18n();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('');
  const [cash, setCash] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<PosSaleResult | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const args = { q: q || undefined, limit: 24 };
  const adminProducts = usePosProductsQuery(args, { skip: scope !== 'admin' });
  const sellerProducts = useSellerPosProductsQuery(args, { skip: scope !== 'seller' });
  const { data: products, isFetching, isLoading } = scope === 'admin' ? adminProducts : sellerProducts;
  const [adminSell, adminSellState] = usePosSellMutation();
  const [sellerSell, sellerSellState] = useSellerPosSellMutation();
  const sell = scope === 'admin' ? adminSell : sellerSell;
  const selling = scope === 'admin' ? adminSellState.isLoading : sellerSellState.isLoading;

  // Debounce typing; Enter searches right away (barcode scanners end with Enter).
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const inCart = (variantId: string) => lines.find((l) => l.variant.id === variantId)?.quantity ?? 0;
  const add = (product: Line['product'], variant: PosVariant) => {
    if (inCart(variant.id) >= variant.stock) {
      toast.error(`Only ${variant.stock} in stock`);
      return;
    }
    setLines((prev) =>
      prev.some((l) => l.variant.id === variant.id)
        ? prev.map((l) => (l.variant.id === variant.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, { product, variant, quantity: 1 }],
    );
  };
  const setQty = (variantId: string, quantity: number) =>
    setLines((prev) => prev.flatMap((l) => (l.variant.id !== variantId ? [l] : quantity <= 0 ? [] : [{ ...l, quantity: Math.min(quantity, l.variant.stock) }])));

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const code = search.trim().toUpperCase();
    // Exact SKU (scanned barcode): add it straight to the cart.
    const hit = products?.flatMap((p) => p.variants.map((v) => ({ p, v }))).find(({ v }) => v.sku.toUpperCase() === code);
    if (hit) {
      add(hit.p, hit.v);
      setSearch('');
      setQ('');
      return;
    }
    setQ(search.trim());
  };

  const subtotal = lines.reduce((s, l) => s + l.variant.price * l.quantity, 0);
  const discountPoisha = Math.min(taka(discount), subtotal);
  const total = subtotal - discountPoisha;
  const cashPoisha = taka(cash);
  const change = cashPoisha - total;
  const discountTooHigh = taka(discount) > subtotal;
  const canSell = lines.length > 0 && !discountTooHigh && cashPoisha >= total;

  const reset = () => {
    setLines([]);
    setDiscount('');
    setCash('');
    setPhone('');
    setName('');
    setNote('');
    setDone(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const complete = async () => {
    try {
      const sale = await sell({
        items: lines.map((l) => ({ variantId: l.variant.id, quantity: l.quantity })),
        discount: discountPoisha,
        cashReceived: cashPoisha,
        customerPhone: phone.trim() || undefined,
        customerName: name.trim() || undefined,
        note: note.trim() || undefined,
      }).unwrap();
      setDone(sale);
      toast.success(`Sale ${sale.order.orderNumber} completed`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Point of sale"
        description={description}
        actions={
          <Link href={salesHref} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 text-sm font-medium hover:bg-ink-50">
            <Receipt className="size-4" /> Counter sales
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0">
          <form onSubmit={onSearch} className="card mb-3 flex items-center gap-2 p-2">
            <Search className="ml-1 size-5 shrink-0 text-ink-400" />
            <input
              ref={searchRef}
              autoFocus
              aria-label="Search products or scan SKU"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Search by product name, or scan / type a SKU and press Enter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="rounded p-1 text-ink-400 hover:bg-ink-100" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
            <span className="hidden items-center gap-1 rounded bg-ink-50 px-2 py-1 text-xs text-ink-500 sm:flex">
              <Barcode className="size-4" /> SKU
            </span>
          </form>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : !products?.length ? (
            <div className="card">
              <EmptyState icon={<PackageSearch />} title="No products found" text={q ? `Nothing in the shop matches "${q}".` : 'Active products of your shop appear here.'} />
            </div>
          ) : (
            <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', isFetching && 'opacity-60')}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} inCart={inCart} onAdd={(v) => add(p, v)} />
              ))}
            </div>
          )}
        </section>

        <aside id="pos-cart" className="card flex h-fit scroll-mt-20 flex-col xl:sticky xl:top-20" aria-label="Counter cart">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="size-5 text-primary-700" /> Current sale
              {lines.length > 0 && <Badge tone="primary">{lines.reduce((s, l) => s + l.quantity, 0)} items</Badge>}
            </h3>
            {lines.length > 0 && (
              <button type="button" onClick={() => setLines([])} className="text-xs font-medium text-danger hover:underline">
                Clear
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-500">Tap a product or scan a SKU to start a sale.</p>
          ) : (
            <ul className="max-h-[40vh] divide-y divide-ink-100 overflow-y-auto">
              {lines.map((l) => (
                <li key={l.variant.id} className="flex gap-3 px-4 py-3">
                  <Thumb src={l.product.imageUrl} className="size-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.product.title}</p>
                    <p className="text-xs text-ink-500">
                      {l.variant.label !== 'Default' ? `${l.variant.label} · ` : ''}
                      {l.variant.sku} · {money(l.variant.price)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-ink-200">
                        <button type="button" className="flex h-full w-8 items-center justify-center hover:bg-ink-50" onClick={() => setQty(l.variant.id, l.quantity - 1)} aria-label="Decrease quantity">
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          aria-label={`Quantity of ${l.product.title}`}
                          className="h-full w-10 border-x border-ink-200 text-center text-sm font-semibold tabular-nums outline-none"
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) => setQty(l.variant.id, Number(e.target.value.replace(/\D/g, '')) || 1)}
                        />
                        <button type="button" className="flex h-full w-8 items-center justify-center hover:bg-ink-50 disabled:opacity-40" onClick={() => setQty(l.variant.id, l.quantity + 1)} disabled={l.quantity >= l.variant.stock} aria-label="Increase quantity">
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">{money(l.variant.price * l.quantity)}</span>
                      <button type="button" onClick={() => setQty(l.variant.id, 0)} className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-danger" aria-label={`Remove ${l.product.title}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t border-ink-100 px-4 py-3">
            <details className="group rounded-md border border-ink-100 px-3 py-2 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-ink-700">
                <UserRound className="size-4" /> Customer <span className="font-normal text-ink-400">(optional)</span>
                <span className="ml-auto truncate text-xs font-normal text-ink-500">{phone || name || 'Walk-in'}</span>
              </summary>
              <div className="mt-2 grid gap-2">
                <input className="input" placeholder="Phone (links the sale to their account)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Customer phone" />
                <input className="input" placeholder="Name (for walk-in customers)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Customer name" />
                <input className="input" placeholder="Note on the receipt" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              </div>
            </details>

            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Subtotal</dt>
                <dd className="font-medium">{money(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-600">Discount (৳)</dt>
                <dd>
                  <input
                    aria-label="Discount in taka"
                    className={cn('input h-8 w-28 text-right', discountTooHigh && 'border-danger')}
                    inputMode="decimal"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </dd>
              </div>
              {discountTooHigh && <p className="text-right text-xs text-danger">Discount is more than the subtotal</p>}
              <div className="flex justify-between border-t border-dashed border-ink-200 pt-2 text-lg font-bold">
                <dt>Total</dt>
                <dd className="text-accent-600">{money(total)}</dd>
              </div>
            </dl>

            <div className="rounded-lg bg-ink-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Banknote className="size-4 text-primary-700" /> Payment: Cash
              </p>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-600">Cash received (৳)</span>
                <input
                  aria-label="Cash received in taka"
                  className="input h-9 w-32 text-right font-semibold"
                  inputMode="decimal"
                  placeholder="0"
                  value={cash}
                  onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </label>
              {total > 0 && (
                <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                  {quickCash(total).map((v, i) => (
                    <button key={v} type="button" onClick={() => setCash(String(v))} className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-medium hover:border-primary-500">
                      {i === 0 ? 'Exact' : `৳${v.toLocaleString('en-US')}`}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-ink-600">{change >= 0 ? 'Change to give' : 'Still due'}</span>
                <span className={cn('text-base font-bold', change >= 0 ? 'text-primary-700' : 'text-danger')} aria-label="Change">
                  {money(Math.abs(cash ? change : 0))}
                </span>
              </div>
            </div>

            <Button block size="lg" onClick={() => void complete()} loading={selling} disabled={!canSell}>
              Complete sale · {money(total)}
            </Button>
          </div>
        </aside>
      </div>

      {/* Phones: the cart sits below the product grid, so keep the running total in reach. */}
      {lines.length > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth' })}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-xl bg-primary-700 px-4 py-3 text-white shadow-raised xl:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="size-5" /> {lines.reduce((s, l) => s + l.quantity, 0)} items
          </span>
          <span className="font-bold">{money(total)} · Checkout</span>
        </button>
      )}

      <Modal open={Boolean(done)} onClose={reset} title="Sale completed">
        {done && (
          <div className="space-y-4">
            <div className="rounded-lg bg-primary-50 p-3 text-center">
              <p className="text-sm text-primary-800">Change to give</p>
              <p className="text-2xl font-bold text-primary-700">{money(done.change)}</p>
              {done.customer && <p className="mt-1 text-xs text-primary-800">Saved to {done.customer.name}&apos;s account</p>}
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-ink-100 p-4">
              <PosReceipt sale={done} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => window.open(`/receipt/${done.order.id}?print=1`, '_blank', 'noopener')}>
                <Printer className="size-4" /> Print receipt
              </Button>
              <Button onClick={reset}>New sale</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
