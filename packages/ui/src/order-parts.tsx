'use client';

import type { OrderItemView, ShippingAddressSnapshot, StatusEvent } from '@marketbd/shared';
import { CheckCircle2, Circle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from './i18n';

const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

/** Horizontal progress for the main flow plus a full event list. */
export function OrderTimeline({ events, current }: { events: StatusEvent[]; current: StatusEvent['status'] }) {
  const { t, locale } = useI18n();
  const reached = FLOW.indexOf(current as (typeof FLOW)[number]);
  return (
    <div className="space-y-4">
      {reached >= 0 && (
        <ol className="flex items-center">
          {FLOW.map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <span className="flex flex-col items-center gap-1 text-[11px]">
                {i <= reached ? <CheckCircle2 className="size-6 text-primary-600" /> : <Circle className="size-6 text-ink-300" />}
                <span className={i <= reached ? 'font-semibold text-primary-800' : 'text-ink-400'}>{t.status[s]}</span>
              </span>
              {i < FLOW.length - 1 && <span className={`mx-1 mb-4 h-0.5 flex-1 ${i < reached ? 'bg-primary-600' : 'bg-ink-200'}`} />}
            </li>
          ))}
        </ol>
      )}
      <ul className="space-y-2 border-l-2 border-ink-100 pl-4 text-sm">
        {[...events].reverse().map((e, i) => (
          <li key={`${e.createdAt}-${i}`}>
            <p className="font-medium">{t.status[e.status]}</p>
            <p className="text-xs text-ink-500">
              {new Date(e.createdAt).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              {e.note ? ` · ${e.note}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddressBlock({ address }: { address: ShippingAddressSnapshot }) {
  return (
    <div className="text-sm">
      <p className="font-semibold">
        {address.fullName} · {address.phone}
      </p>
      <p className="text-ink-600">
        {address.addressLine}
        {address.landmark ? ` (${address.landmark})` : ''}, {address.area}, {address.district}, {address.division}
      </p>
    </div>
  );
}

export function OrderItemRow({ item, action }: { item: OrderItemView; action?: ReactNode }) {
  const { money } = useI18n();
  return (
    <li className="flex gap-3 py-3">
      <Link href={`/p/${item.productSlug}`} className="relative size-16 shrink-0 overflow-hidden rounded bg-ink-50">
        {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <Link href={`/p/${item.productSlug}`} className="line-clamp-1 hover:text-primary-700">
          {item.title}
        </Link>
        <p className="text-xs text-ink-500">
          {item.variantLabel} · {item.sku}
        </p>
        <p className="mt-1">
          {money(item.unitPrice)} × {item.quantity} = <b>{money(item.lineTotal)}</b>
        </p>
      </div>
      {action}
    </li>
  );
}
