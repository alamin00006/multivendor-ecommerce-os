'use client';

import { useManagedProductsQuery } from '@marketbd/api-client';
import type { ManagedProduct } from '@marketbd/shared';
import Image from 'next/image';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { Button, Modal } from '../primitives';

/** Search active products and pick one or more (campaigns, flash sales). */
export function ProductPicker({
  open,
  onClose,
  onPick,
  pickLabel = 'Add',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (product: ManagedProduct) => void;
  pickLabel?: string;
}) {
  const { money } = useI18n();
  const [q, setQ] = useState('');
  const { data, isFetching } = useManagedProductsQuery({ scope: 'admin', q: q || undefined, status: 'ACTIVE', limit: 20 }, { skip: !open });
  return (
    <Modal open={open} onClose={onClose} title="Choose products" size="lg">
      <input className="input mb-3" placeholder="Search title or SKU" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {isFetching && <p className="text-sm text-ink-500">Searching…</p>}
      <ul className="divide-y divide-ink-100">
        {data?.items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <div className="relative size-10 shrink-0 overflow-hidden rounded bg-ink-50">
              {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">{p.title}</p>
              <p className="text-xs text-ink-500">{p.seller.shopName} · {money(p.minPrice)}</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => onPick(p)}>{pickLabel}</Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
