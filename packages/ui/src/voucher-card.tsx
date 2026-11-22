'use client';

import { BRAND } from '@marketbd/shared';
import type { CouponView, PaymentMethod } from '@marketbd/shared';
import { Clock, CreditCard, Loader2, ShoppingBag, Smartphone, Store, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from './i18n';
import { cn } from './primitives';

const METHOD_LABEL: Record<PaymentMethod, string> = { COD: 'Cash on Delivery', BKASH: 'bKash', SSLCOMMERZ: 'Card & mobile banking', CASH: 'Cash' };

/** Colours per voucher kind: platform = accent, store = blue, payment = green. */
const THEME = {
  PLATFORM: { border: 'border-accent-400', bg: 'bg-accent-50/60', text: 'text-accent-700', button: 'bg-accent-500 hover:bg-accent-600', outline: 'border-accent-500 text-accent-700' },
  STORE: { border: 'border-sky-600', bg: 'bg-sky-50/70', text: 'text-sky-800', button: 'bg-sky-500 hover:bg-sky-600', outline: 'border-sky-600 text-sky-800' },
  PAYMENT: { border: 'border-emerald-600', bg: 'bg-emerald-50/70', text: 'text-emerald-800', button: 'bg-emerald-500 hover:bg-emerald-600', outline: 'border-emerald-600 text-emerald-800' },
} as const;

const DAY = 86_400_000;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** "Free Delivery", "Storewide · Gadget Ghor" or "Payment · bKash". */
export const voucherKind = (v: CouponView) =>
  v.type === 'FREE_SHIPPING'
    ? v.scope === 'STORE' && v.seller
      ? `Free Delivery · ${v.seller.shopName}`
      : 'Free Delivery'
    : v.scope === 'STORE'
      ? `Storewide · ${v.seller?.shopName ?? 'Shop'}`
      : v.scope === 'PAYMENT' && v.paymentMethod
        ? `Payment · ${METHOD_LABEL[v.paymentMethod]}`
        : `${BRAND.name} Voucher`;

/** Where "Use Now" sends the customer. */
export const voucherUseHref = (v: CouponView) => (v.scope === 'STORE' && v.seller ? `/shop/${v.seller.slug}` : '/cart');

function Icon({ v }: { v: CouponView }) {
  const box = 'grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg';
  if (v.scope === 'STORE' && v.seller?.logoUrl) {
    return (
      <span className={cn(box, 'bg-white')}>
        <Image src={v.seller.logoUrl} alt="" width={44} height={44} className="size-11 object-cover" />
      </span>
    );
  }
  if (v.type === 'FREE_SHIPPING') return <span className={cn(box, 'bg-white text-current')}><Truck className="size-6" /></span>;
  if (v.scope === 'STORE') return <span className={cn(box, 'bg-white text-current')}><Store className="size-6" /></span>;
  if (v.scope === 'PAYMENT') {
    const I = v.paymentMethod === 'BKASH' ? Smartphone : CreditCard;
    return <span className={cn(box, 'bg-white text-current')}><I className="size-6" /></span>;
  }
  return <span className={cn(box, 'bg-accent-500 text-white')}><ShoppingBag className="size-6" /></span>;
}

export interface VoucherCardProps {
  voucher: CouponView;
  /** AVAILABLE (default), or a wallet state that greys the card out. */
  status?: 'AVAILABLE' | 'USED' | 'EXPIRED';
  onCollect?: () => void;
  collecting?: boolean;
  /** Replaces the default Collect / Use Now button (e.g. "Apply" at checkout). */
  action?: ReactNode;
  className?: string;
}

export function VoucherCard({ voucher: v, status = 'AVAILABLE', onCollect, collecting, action, className }: VoucherCardProps) {
  const { money } = useI18n();
  const t = THEME[v.scope];
  const daysLeft = Math.ceil((new Date(v.endsAt).getTime() - Date.now()) / DAY);
  const inactive = status !== 'AVAILABLE';
  const amount =
    v.type === 'FREE_SHIPPING' ? (v.value > 0 ? `${money(v.value)}` : 'Free') : v.type === 'PERCENTAGE' ? `${v.value}%` : money(v.value);
  const terms = [
    `Code: ${v.code}`,
    v.description,
    v.scope === 'STORE' && v.seller ? `Only for items from ${v.seller.shopName}.` : null,
    v.scope === 'PAYMENT' && v.paymentMethod ? `Pay with ${METHOD_LABEL[v.paymentMethod]} to use it.` : null,
    v.type === 'FREE_SHIPPING' ? (v.value > 0 ? `Takes up to ${money(v.value)} off delivery.` : 'Covers the delivery fee.') : null,
    `Use up to ${v.perUserLimit} time${v.perUserLimit > 1 ? 's' : ''} per customer.`,
    'One voucher per order.',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={cn('relative rounded-xl border', t.border, t.bg, t.text, inactive && 'opacity-55 grayscale', className)}>
      <div className="flex gap-3 p-3 pb-2.5">
        <Icon v={v} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{voucherKind(v)}</p>
            <div className="flex shrink-0 items-center gap-1">
              {daysLeft <= 14 && daysLeft > 0 && status === 'AVAILABLE' && (
                <span className="rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                  Expires in {daysLeft} day{daysLeft > 1 ? 's' : ''}
                </span>
              )}
              <span title={terms} className="cursor-help rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold">
                T&amp;C
              </span>
            </div>
          </div>
          <p className="mt-0.5 leading-tight">
            <span className="text-2xl font-bold">{amount}</span>
            <span className="ml-1 text-sm">{v.type === 'FREE_SHIPPING' && v.value === 0 ? 'delivery' : 'off'}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500">
            Min. Spend {money(v.minOrderAmount)}
            {v.maxDiscount ? <span className="ml-2">Max. Discount {money(v.maxDiscount)}</span> : null}
          </p>
        </div>
      </div>

      {/* Ticket cut-outs and perforation */}
      <div className="relative mx-3 border-t border-dashed border-current/40">
        <span className={cn('absolute -left-[19px] -top-2 size-4 rounded-full border bg-canvas', t.border, 'border-l-transparent border-t-transparent rotate-[-45deg]')} />
        <span className={cn('absolute -right-[19px] -top-2 size-4 rounded-full border bg-canvas', t.border, 'border-r-transparent border-b-transparent rotate-[-45deg]')} />
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
          <Clock className="size-3.5" />
          {fmtDate(v.startsAt)}–{fmtDate(v.endsAt)}
        </span>
        {action ??
          (status === 'USED' ? (
            <span className="text-xs font-semibold text-ink-500">Used</span>
          ) : status === 'EXPIRED' ? (
            <span className="text-xs font-semibold text-ink-500">Expired</span>
          ) : v.collected ? (
            <Link href={voucherUseHref(v)} className={cn('rounded-md border bg-white px-4 py-1 text-xs font-semibold', t.outline)}>
              Use Now
            </Link>
          ) : (
            <button
              type="button"
              onClick={onCollect}
              disabled={collecting}
              className={cn('flex min-w-20 items-center justify-center rounded-md px-4 py-1 text-xs font-semibold text-white disabled:opacity-60', t.button)}
            >
              {collecting ? <Loader2 className="size-3.5 animate-spin" /> : 'Collect'}
            </button>
          ))}
      </div>

      {v.collected && status === 'AVAILABLE' && (
        <span
          aria-label="Collected"
          className="pointer-events-none absolute right-3 top-9 grid size-12 rotate-[-18deg] place-items-center rounded-full border-2 border-double border-ink-400 text-[8px] font-bold tracking-wide text-ink-500"
        >
          COLLECTED
        </span>
      )}
    </div>
  );
}
