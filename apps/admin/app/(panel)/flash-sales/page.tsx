'use client';

import { errorMessage, useAdminDeleteFlashSaleMutation, useAdminFlashSalesQuery, useAdminSaveFlashSaleMutation } from '@marketbd/api-client';
import { FlashSaleSchema, type FlashSaleView, fromPoisha, toPoisha } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fromLocalInput, issuesToErrors, toLocalInput, fmtDate, PageHeader, Table, ProductPicker, useI18n, Badge, Button, Modal, Skeleton } from '@marketbd/ui';

interface ItemDraft {
  variantId: string;
  label: string;
  regularPrice: number;
  specialPrice: string; // taka
  stockLimit: string;
  soldCount: number;
}

interface Draft {
  id?: string;
  title: string;
  titleBn: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  items: ItemDraft[];
}

const fromView = (s: FlashSaleView): Draft => ({
  id: s.id,
  title: s.title,
  titleBn: s.titleBn ?? '',
  startAt: toLocalInput(s.startAt),
  endAt: toLocalInput(s.endAt),
  isActive: s.isActive,
  items: s.items.map((i) => ({
    variantId: i.variantId,
    label: `${i.product.title} — ${i.variantLabel}`,
    regularPrice: i.regularPrice,
    specialPrice: String(fromPoisha(i.specialPrice)),
    stockLimit: String(i.stockLimit),
    soldCount: i.soldCount,
  })),
});

export default function AdminFlashSalesPage() {
  const { money } = useI18n();
  const { data, isLoading } = useAdminFlashSalesQuery();
  const [save, state] = useAdminSaveFlashSaleMutation();
  const [remove] = useAdminDeleteFlashSaleMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!draft) return;
    const body = {
      title: draft.title,
      titleBn: draft.titleBn || undefined,
      startAt: fromLocalInput(draft.startAt) ?? '',
      endAt: fromLocalInput(draft.endAt) ?? '',
      isActive: draft.isActive,
      items: draft.items.map((i, idx) => ({ variantId: i.variantId, specialPrice: toPoisha(Number(i.specialPrice || 0)), stockLimit: Number(i.stockLimit || 0), sortOrder: idx })),
    };
    const parsed = FlashSaleSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      await save({ id: draft.id, body }).unwrap();
      toast.success('Flash sale saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const [now] = useState(() => Date.now());
  return (
    <div>
      <PageHeader
        title="Flash sales"
        description="Time-boxed special prices with a stock limit per variant."
        actions={<Button onClick={() => setDraft({ title: 'Flash Sale', titleBn: 'ফ্ল্যাশ সেল', startAt: toLocalInput(new Date().toISOString()), endAt: '', isActive: true, items: [] })}><Plus className="size-4" /> Flash sale</Button>}
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Sale', 'Window', 'Items', 'Sold', 'Status', '']}>
            {data?.map((s) => {
              const live = s.isActive && new Date(s.startAt).getTime() <= now && new Date(s.endAt).getTime() > now;
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3 text-xs">{fmtDate(s.startAt)}<br />→ {fmtDate(s.endAt)}</td>
                  <td className="px-4 py-3">{s.items.length}</td>
                  <td className="px-4 py-3">{s.items.reduce((n, i) => n + i.soldCount, 0)}</td>
                  <td className="px-4 py-3"><Badge tone={live ? 'success' : 'neutral'}>{live ? 'Live' : 'Not live'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDraft(fromView(s))} aria-label="Edit"><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => confirm('Delete this flash sale?') && void remove(s.id)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit flash sale' : 'New flash sale'} size="xl">
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Title</label>
                <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                {errors.title && <p className="field-error">{errors.title}</p>}
              </div>
              <div>
                <label className="label">Title (বাংলা)</label>
                <input className="input" value={draft.titleBn} onChange={(e) => setDraft({ ...draft, titleBn: e.target.value })} />
              </div>
              <div>
                <label className="label">Starts</label>
                <input className="input" type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} />
                {errors.startAt && <p className="field-error">{errors.startAt}</p>}
              </div>
              <div>
                <label className="label">Ends</label>
                <input className="input" type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} />
                {errors.endAt && <p className="field-error">{errors.endAt}</p>}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
              </label>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Items</h3>
              <Button size="sm" variant="soft" onClick={() => setPicking(true)}><Plus className="size-4" /> Add product</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase text-ink-500">
                  <tr><th className="py-2">Variant</th><th>Regular</th><th>Flash price (৳)</th><th>Stock limit</th><th>Sold</th><th /></tr>
                </thead>
                <tbody>
                  {draft.items.map((it, i) => (
                    <tr key={it.variantId} className="border-t border-ink-100">
                      <td className="max-w-xs py-2 pr-2 text-xs">{it.label}</td>
                      <td className="pr-2 text-xs">{money(it.regularPrice)}</td>
                      <td className="pr-2">
                        <input className="input h-8 w-24" value={it.specialPrice} onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, j) => (j === i ? { ...x, specialPrice: e.target.value } : x)) })} />
                        {errors[`items.${i}.specialPrice`] && <p className="field-error">{errors[`items.${i}.specialPrice`]}</p>}
                      </td>
                      <td className="pr-2">
                        <input className="input h-8 w-20" value={it.stockLimit} onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, j) => (j === i ? { ...x, stockLimit: e.target.value.replace(/\D/g, '') } : x)) })} />
                      </td>
                      <td className="pr-2 text-xs">{it.soldCount}</td>
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="size-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button block loading={state.isLoading} onClick={() => void submit()}>Save</Button>
          </div>
        )}
      </Modal>
      <ProductPicker
        open={picking}
        onClose={() => setPicking(false)}
        pickLabel="Add variants"
        onPick={(p) => {
          if (!draft) return;
          const existing = new Set(draft.items.map((i) => i.variantId));
          const added = p.variants
            .filter((v) => v.isActive && !existing.has(v.id))
            .map((v) => ({
              variantId: v.id,
              label: `${p.title} — ${Object.values(v.attributes).join(' / ') || 'Default'}`,
              regularPrice: v.price,
              specialPrice: String(Math.round(fromPoisha(v.price) * 0.8)),
              stockLimit: String(Math.min(50, v.stock)),
              soldCount: 0,
            }));
          setDraft({ ...draft, items: [...draft.items, ...added] });
          setPicking(false);
        }}
      />
    </div>
  );
}
