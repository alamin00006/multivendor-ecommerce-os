'use client';

import { useMySellerProfileQuery, useSellerOrderQuery } from '@marketbd/api-client';
import type { SellerOrderView } from '@marketbd/shared';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button, cn, ErrorState, RequireAuth, Spinner, useI18n } from '@marketbd/ui';

const METHOD: Record<string, string> = { COD: 'Cash on Delivery', BKASH: 'bKash', SSLCOMMERZ: 'Card / mobile banking', CASH: 'Cash' };
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function Address({ o }: { o: SellerOrderView }) {
  const a = o.shippingAddress;
  return (
    <div className="text-sm leading-relaxed">
      <p className="font-semibold">{a.fullName}</p>
      <p>{a.phone}</p>
      <p>{a.addressLine}</p>
      {a.landmark && <p>Near {a.landmark}</p>}
      <p>{[a.area, a.district, a.division].filter(Boolean).join(', ')}</p>
    </div>
  );
}

/** Customer invoice for one package. */
function Invoice({ o, shop }: { o: SellerOrderView; shop: { name: string; phone: string | null; address: string | null } }) {
  const { money } = useI18n();
  const due = o.paymentStatus === 'PAID' ? 0 : o.total;
  return (
    <section className="invoice-sheet bg-white p-8 text-ink-900">
      <header className="flex items-start justify-between gap-6 border-b border-ink-200 pb-4">
        <div>
          <p className="font-display text-2xl font-bold">{shop.name}</p>
          {shop.address && <p className="text-sm text-ink-600">{shop.address}</p>}
          {shop.phone && <p className="text-sm text-ink-600">{shop.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase tracking-wide text-ink-500">Invoice</p>
          <p className="text-sm">
            No. <span className="font-semibold">{o.orderNumber}</span>
          </p>
          <p className="text-sm">Date {day(o.createdAt)}</p>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Bill to</p>
          <Address o={o} />
        </div>
        <div className="text-right text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Payment</p>
          <p>{METHOD[o.paymentMethod] ?? o.paymentMethod}</p>
          <p className={cn('font-semibold', o.paymentStatus === 'PAID' ? 'text-primary-700' : 'text-accent-600')}>{o.paymentStatus === 'PAID' ? 'Paid' : 'Not paid yet'}</p>
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-ink-800 text-left text-xs uppercase tracking-wide">
            <th className="py-2 pr-2">Item</th>
            <th className="px-2 py-2">SKU</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">Unit price</th>
            <th className="py-2 pl-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-ink-100">
              <td className="py-2 pr-2">
                {i.title}
                {i.variantLabel !== 'Default' && <span className="block text-xs text-ink-500">{i.variantLabel}</span>}
              </td>
              <td className="px-2 py-2 font-mono text-xs">{i.sku}</td>
              <td className="px-2 py-2 text-right">{i.quantity}</td>
              <td className="px-2 py-2 text-right">{money(i.unitPrice)}</td>
              <td className="py-2 pl-2 text-right">{money(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{money(o.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{money(o.shippingFee)}</dd>
        </div>
        {o.subtotal + o.shippingFee - o.total > 0 && (
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd>−{money(o.subtotal + o.shippingFee - o.total)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-ink-800 pt-1 text-base font-bold">
          <dt>Total</dt>
          <dd>{money(o.total)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>{o.paymentMethod === 'COD' && due ? 'Collect on delivery' : 'Amount due'}</dt>
          <dd>{money(due)}</dd>
        </div>
      </dl>
      <p className="mt-10 text-center text-xs text-ink-500">Thank you for your order. Sold via MarketBD.</p>
    </section>
  );
}

/** Packing slip: what goes in the parcel and where it goes — no prices. */
function PackingSlip({ o, shop }: { o: SellerOrderView; shop: { name: string; phone: string | null; address: string | null } }) {
  const { money } = useI18n();
  const cod = o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID';
  return (
    <section className="invoice-sheet bg-white p-8 text-ink-900">
      <header className="flex items-start justify-between border-b-2 border-ink-800 pb-3">
        <p className="text-xl font-bold uppercase tracking-wide">Packing slip</p>
        <div className="text-right text-sm">
          <p className="font-mono text-lg font-bold">{o.orderNumber}</p>
          {o.trackingNumber && <p>Tracking {o.trackingNumber}</p>}
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="rounded-md border-2 border-ink-800 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Deliver to</p>
          <Address o={o} />
        </div>
        <div className="space-y-3">
          <div className="text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">From</p>
            <p className="font-semibold">{shop.name}</p>
            {shop.address && <p>{shop.address}</p>}
            {shop.phone && <p>{shop.phone}</p>}
          </div>
          <div className={cn('rounded-md p-3 text-center', cod ? 'border-2 border-ink-800' : 'bg-ink-50')}>
            <p className="text-xs font-semibold uppercase tracking-wide">{cod ? 'Collect cash' : 'Prepaid'}</p>
            <p className="text-2xl font-bold">{cod ? money(o.total) : '৳0'}</p>
          </div>
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-ink-800 text-left text-xs uppercase tracking-wide">
            <th className="w-8 py-2">✓</th>
            <th className="py-2 pr-2">Item</th>
            <th className="px-2 py-2">SKU</th>
            <th className="py-2 pl-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-ink-100">
              <td className="py-2">
                <span className="inline-block size-4 border border-ink-600" />
              </td>
              <td className="py-2 pr-2">
                {i.title}
                {i.variantLabel !== 'Default' && <span className="block text-xs text-ink-500">{i.variantLabel}</span>}
              </td>
              <td className="px-2 py-2 font-mono text-xs">{i.sku}</td>
              <td className="py-2 pl-2 text-right text-base font-bold">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-right text-sm">
        Total pieces: <strong>{o.items.reduce((s, i) => s + i.quantity, 0)}</strong>
      </p>
    </section>
  );
}

function Documents() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const [kind, setKind] = useState<'invoice' | 'slip' | 'both'>(() => (params.get('type') === 'slip' ? 'slip' : params.get('type') === 'both' ? 'both' : 'invoice'));
  const { data: o, isError, refetch } = useSellerOrderQuery(id);
  const { data: profile } = useMySellerProfileQuery();
  const autoPrint = params.get('print') === '1';
  const ready = Boolean(o && profile);

  useEffect(() => {
    if (!ready || !autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [ready, autoPrint]);

  if (isError) return <ErrorState message="Order not found" onRetry={() => void refetch()} />;
  if (!o || !profile) return <Spinner className="mx-auto mt-20" />;
  const shop = { name: profile.shopName, phone: profile.phone, address: profile.pickupAddress };

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[800px] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/seller/orders/${o.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
          <ArrowLeft className="size-4" /> Back to order
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-ink-200 bg-white p-0.5 text-sm" role="tablist">
            {(
              [
                ['invoice', 'Invoice'],
                ['slip', 'Packing slip'],
                ['both', 'Both'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn('rounded px-3 py-1', kind === k ? 'bg-primary-700 font-semibold text-white' : 'text-ink-600')}>
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-[800px] space-y-4 print:max-w-none print:space-y-0">
        {kind !== 'slip' && (
          <div className="shadow-card print:shadow-none">
            <Invoice o={o} shop={shop} />
          </div>
        )}
        {kind === 'both' && <div className="hidden break-after-page print:block" />}
        {kind !== 'invoice' && (
          <div className="shadow-card print:shadow-none">
            <PackingSlip o={o} shop={shop} />
          </div>
        )}
      </div>
    </>
  );
}

/** Seller Center → order → Print: invoice and/or packing slip (A4). */
export default function InvoicePage() {
  return (
    <RequireAuth roles={['SELLER']}>
      <style>{'@page { size: A4; margin: 10mm; } @media print { body { background: #fff !important; } .invoice-sheet { padding: 0 !important; } }'}</style>
      <main className="min-h-dvh bg-canvas p-4 print:bg-white print:p-0">
        <Suspense fallback={<Spinner className="mx-auto mt-20" />}>
          <Documents />
        </Suspense>
      </main>
    </RequireAuth>
  );
}
