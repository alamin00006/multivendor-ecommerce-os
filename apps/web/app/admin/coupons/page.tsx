'use client';

import { errorMessage, useAdminCouponsQuery, useAdminDeleteCouponMutation, useAdminSaveCouponMutation } from '@marketbd/api-client';
import { COUPON_TYPES, type CouponType, CouponSchema, type CouponView, fromPoisha, toPoisha } from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fromLocalInput, issuesToErrors, toLocalInput } from '@/components/manage/form-utils';
import { fmtDate, PageHeader, Table } from '@/components/manage/panel';
import { useI18n } from '@/i18n/client';
import { Badge, Button, Modal, Skeleton } from '@/components/ui';

interface Draft {
  id?: string;
  code: string;
  description: string;
  type: CouponType;
  value: string; // % or taka
  minOrderAmount: string; // taka
  maxDiscount: string; // taka
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const fromView = (c: CouponView): Draft => ({
  id: c.id,
  code: c.code,
  description: c.description ?? '',
  type: c.type,
  value: String(c.type === 'FIXED' ? fromPoisha(c.value) : c.value),
  minOrderAmount: String(fromPoisha(c.minOrderAmount)),
  maxDiscount: c.maxDiscount ? String(fromPoisha(c.maxDiscount)) : '',
  usageLimit: c.usageLimit ? String(c.usageLimit) : '',
  perUserLimit: String(c.perUserLimit),
  startsAt: toLocalInput(c.startsAt),
  endsAt: toLocalInput(c.endsAt),
  isActive: c.isActive,
});

export default function AdminCouponsPage() {
  const { money } = useI18n();
  const { data, isLoading } = useAdminCouponsQuery();
  const [save, state] = useAdminSaveCouponMutation();
  const [remove] = useAdminDeleteCouponMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!draft) return;
    const body = {
      code: draft.code.toUpperCase(),
      description: draft.description || undefined,
      type: draft.type,
      value: draft.type === 'FIXED' ? toPoisha(Number(draft.value || 0)) : Number(draft.value || 0),
      minOrderAmount: toPoisha(Number(draft.minOrderAmount || 0)),
      maxDiscount: draft.maxDiscount ? toPoisha(Number(draft.maxDiscount)) : null,
      usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
      perUserLimit: Number(draft.perUserLimit || 1),
      startsAt: fromLocalInput(draft.startsAt) ?? '',
      endsAt: fromLocalInput(draft.endsAt) ?? '',
      isActive: draft.isActive,
    };
    const parsed = CouponSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    try {
      await save({ id: draft.id, body }).unwrap();
      toast.success('Coupon saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const field = (key: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    draft && (
      <div>
        <label className="label">{label}</label>
        <input className="input" value={String(draft[key])} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} {...props} />
        {errors[key] && <p className="field-error">{errors[key]}</p>}
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Coupons"
        actions={<Button onClick={() => setDraft({ code: '', description: '', type: 'PERCENTAGE', value: '10', minOrderAmount: '0', maxDiscount: '', usageLimit: '', perUserLimit: '1', startsAt: toLocalInput(new Date().toISOString()), endsAt: '', isActive: true })}><Plus className="size-4" /> Coupon</Button>}
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Code', 'Discount', 'Min order', 'Used', 'Valid', 'Status', '']}>
            {data?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3"><b>{c.code}</b><br /><span className="text-xs text-ink-500">{c.description}</span></td>
                <td className="px-4 py-3">{c.type === 'PERCENTAGE' ? `${c.value}%${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ''}` : money(c.value)}</td>
                <td className="px-4 py-3">{money(c.minOrderAmount)}</td>
                <td className="px-4 py-3">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                <td className="px-4 py-3 text-xs">{fmtDate(c.startsAt)}<br />→ {fmtDate(c.endsAt)}</td>
                <td className="px-4 py-3"><Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Off'}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(fromView(c))} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${c.code}?`) && void remove(c.id)} aria-label="Delete"><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit coupon' : 'New coupon'} size="lg">
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field('code', 'Code', { className: 'input uppercase' })}
            <div>
              <label className="label">Type</label>
              <select className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CouponType })}>
                {COUPON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {field('value', draft.type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (৳)', { inputMode: 'decimal' })}
            {field('maxDiscount', 'Max discount (৳, optional)', { inputMode: 'decimal' })}
            {field('minOrderAmount', 'Minimum order (৳)', { inputMode: 'decimal' })}
            {field('usageLimit', 'Total uses (optional)', { inputMode: 'numeric' })}
            {field('perUserLimit', 'Uses per customer', { inputMode: 'numeric' })}
            {field('description', 'Description')}
            {field('startsAt', 'Starts', { type: 'datetime-local' })}
            {field('endsAt', 'Ends', { type: 'datetime-local' })}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
            </label>
            <Button className="sm:col-span-2" loading={state.isLoading} onClick={() => void submit()}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
