'use client';

import { productsPath } from '../urls';
import {
  errorMessage,
  useDeleteManagedProductMutation,
  useManagedProductsQuery,
  useSetProductStatusMutation,
  useUpdateStockMutation,
} from '@marketbd/api-client';
import { PRODUCT_STATUSES, type ProductStatus } from '@marketbd/shared';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '../i18n';
import { Badge, ButtonLink, EmptyState, Skeleton } from '../primitives';
import { PageHeader, Pager, Table } from './panel';

const STATUS_TONE: Record<ProductStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  INACTIVE: 'neutral',
  REJECTED: 'danger',
};

/** Product list with search, status filter, inline stock editing and delete. */
export function ProductTable({ scope }: { scope: 'seller' | 'admin' }) {
  const { money } = useI18n();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useManagedProductsQuery({ scope, q: q || undefined, status: status || undefined, lowStock: lowStock || undefined, page, limit: 20 });
  const [remove] = useDeleteManagedProductMutation();
  const [updateStock] = useUpdateStockMutation();
  const [setProductStatus] = useSetProductStatusMutation();

  return (
    <div>
      <PageHeader
        title="Products"
        description={data ? `${data.meta.total} products` : undefined}
        actions={
          <ButtonLink href={`${productsPath(scope)}/new`}>
            <Plus className="size-4" /> Add product
          </ButtonLink>
        }
      />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
          <input className="input max-w-xs" placeholder="Search title or SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value as ProductStatus | ''); setPage(1); }}>
            <option value="">All statuses</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary-700" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} /> Low stock
          </label>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <Table
            head={['Product', ...(scope === 'admin' ? ['Seller'] : []), 'Price', 'Stock by variant', 'Status', '']}
            empty={!data?.items.length ? <EmptyState icon={<Package />} title="No products found" /> : null}
          >
            {data?.items.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded bg-ink-50">
                      {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <Link href={`${productsPath(scope)}/${p.id}`} className="line-clamp-2 font-medium hover:text-primary-700">{p.title}</Link>
                      <p className="text-xs text-ink-500">{p.soldCount} sold</p>
                    </div>
                  </div>
                </td>
                {scope === 'admin' && <td className="px-4 py-3 text-xs">{p.seller.shopName}</td>}
                <td className="px-4 py-3 whitespace-nowrap">{money(p.minPrice)}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {p.variants.filter((v) => v.isActive).map((v) => (
                      <label key={v.id} className="flex items-center gap-2 text-xs">
                        <span className="w-28 truncate text-ink-500" title={v.sku}>{Object.values(v.attributes).join('/') || v.sku}</span>
                        <input
                          className={`input h-7 w-16 px-2 ${v.stock <= 5 ? 'border-amber-400' : ''}`}
                          defaultValue={v.stock}
                          inputMode="numeric"
                          onBlur={async (e) => {
                            const stock = Number(e.target.value);
                            if (!Number.isInteger(stock) || stock < 0 || stock === v.stock) return;
                            try {
                              await updateStock({ scope, body: { items: [{ variantId: v.id, stock }] } }).unwrap();
                              toast.success('Stock updated');
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {scope === 'admin' ? (
                    <select className="input h-8 w-auto text-xs" value={p.status} onChange={(e) => void setProductStatus({ id: p.id, status: e.target.value as ProductStatus })}>
                      {PRODUCT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Link href={`${productsPath(scope)}/${p.id}`} className="rounded p-2 hover:bg-ink-50" aria-label="Edit"><Pencil className="size-4" /></Link>
                    <button
                      type="button"
                      className="rounded p-2 text-danger hover:bg-red-50"
                      aria-label="Delete"
                      onClick={async () => {
                        if (!confirm(`Delete "${p.title}"?`)) return;
                        try {
                          const r = await remove({ scope, id: p.id }).unwrap();
                          toast.success(r.deleted ? 'Product deleted' : 'Product has orders — it was deactivated instead');
                        } catch (err) {
                          toast.error(errorMessage(err));
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
    </div>
  );
}
