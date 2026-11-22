'use client';

import {
  errorMessage,
  useAdminCouponsQuery,
  useAdminDeleteCouponMutation,
  useAdminSaveCouponMutation,
  useAdminSellersQuery,
  useSellerCouponsQuery,
  useSellerDeleteCouponMutation,
  useSellerSaveCouponMutation,
} from '@marketbd/api-client';
import {
  COUPON_SCOPES,
  COUPON_TYPES,
  type CouponScope,
  CouponSchema,
  type CouponType,
  type CouponView,
  fromPoisha,
  type PaymentMethod,
  SellerCouponSchema,
  toPoisha,
} from '@marketbd/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { type InputHTMLAttributes, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '../i18n';
import { Badge, Button, Modal, Skeleton } from '../primitives';
import { voucherKind } from '../voucher-card';
import { fromLocalInput, issuesToErrors, toLocalInput } from './form-utils';
import { fmtDate, PageHeader, Table } from './panel';

const TYPE_LABEL: Record<CouponType, string> = { PERCENTAGE: 'Percent off', FIXED: 'Amount off', FREE_SHIPPING: 'Free delivery' };
const SCOPE_LABEL: Record<CouponScope, string> = {
  PLATFORM: 'MarketBD voucher (whole order)',
  STORE: "Store voucher (one shop's items)",
  PAYMENT: 'Payment voucher (online method)',
};
const ONLINE_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'BKASH', label: 'bKash' },
  { value: 'SSLCOMMERZ', label: 'Card & mobile banking (SSLCommerz)' },
];

interface Draft {
  id?: string;
  code: string;
  description: string;
  type: CouponType;
  scope: CouponScope;
  sellerId: string;
  paymentMethod: PaymentMethod | '';
  value: string; // % or taka
  minOrderAmount: string; // taka
  maxDiscount: string; // taka
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const blank = (): Draft => ({
  code: '',
  description: '',
  type: 'PERCENTAGE',
  scope: 'PLATFORM',
  sellerId: '',
  paymentMethod: '',
  value: '10',
  minOrderAmount: '0',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '1',
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: '',
  isActive: true,
});

const fromView = (c: CouponView): Draft => ({
  id: c.id,
  code: c.code,
  description: c.description ?? '',
  type: c.type,
  scope: c.scope,
  sellerId: c.seller?.id ?? '',
  paymentMethod: c.paymentMethod ?? '',
  value: String(c.type === 'PERCENTAGE' ? c.value : fromPoisha(c.value)),
  minOrderAmount: String(fromPoisha(c.minOrderAmount)),
  maxDiscount: c.maxDiscount ? String(fromPoisha(c.maxDiscount)) : '',
  usageLimit: c.usageLimit ? String(c.usageLimit) : '',
  perUserLimit: String(c.perUserLimit),
  startsAt: toLocalInput(c.startsAt),
  endsAt: toLocalInput(c.endsAt),
  isActive: c.isActive,
});

/**
 * Voucher admin for both panels. Admins pick the scope (platform / a shop / a payment method);
 * sellers always manage STORE vouchers for their own shop.
 */
export function VoucherManager({ scope: panel }: { scope: 'admin' | 'seller' }) {
  const { money } = useI18n();
  const admin = panel === 'admin';
  const adminList = useAdminCouponsQuery(undefined, { skip: !admin });
  const sellerList = useSellerCouponsQuery(undefined, { skip: admin });
  const { data: sellers } = useAdminSellersQuery({ status: 'APPROVED', page: 1, limit: 100 }, { skip: !admin });
  const [adminSave, adminSaveState] = useAdminSaveCouponMutation();
  const [sellerSave, sellerSaveState] = useSellerSaveCouponMutation();
  const [adminRemove] = useAdminDeleteCouponMutation();
  const [sellerRemove] = useSellerDeleteCouponMutation();
  const { data, isLoading } = admin ? adminList : sellerList;
  const saving = admin ? adminSaveState.isLoading : sellerSaveState.isLoading;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!draft) return;
    const common = {
      code: draft.code.toUpperCase(),
      description: draft.description || undefined,
      type: draft.type,
      value: draft.type === 'PERCENTAGE' ? Number(draft.value || 0) : toPoisha(Number(draft.value || 0)),
      minOrderAmount: toPoisha(Number(draft.minOrderAmount || 0)),
      maxDiscount: draft.type === 'PERCENTAGE' && draft.maxDiscount ? toPoisha(Number(draft.maxDiscount)) : null,
      usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
      perUserLimit: Number(draft.perUserLimit || 1),
      startsAt: fromLocalInput(draft.startsAt) ?? '',
      endsAt: fromLocalInput(draft.endsAt) ?? '',
      isActive: draft.isActive,
    };
    try {
      if (admin) {
        const body = {
          ...common,
          scope: draft.scope,
          sellerId: draft.scope === 'STORE' ? draft.sellerId || null : null,
          paymentMethod: draft.scope === 'PAYMENT' ? draft.paymentMethod || null : null,
        };
        const parsed = CouponSchema.safeParse(body);
        if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
        setErrors({});
        await adminSave({ id: draft.id, body }).unwrap();
      } else {
        const parsed = SellerCouponSchema.safeParse(common);
        if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
        setErrors({});
        await sellerSave({ id: draft.id, body: common }).unwrap();
      }
      toast.success('Voucher saved');
      setDraft(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async (c: CouponView) => {
    if (!confirm(`Delete ${c.code}? Used vouchers are switched off instead.`)) return;
    try {
      await (admin ? adminRemove(c.id) : sellerRemove(c.id)).unwrap();
      toast.success('Voucher removed');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const field = (key: keyof Draft, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) =>
    draft && (
      <div>
        <label className="label" htmlFor={`v-${key}`}>{label}</label>
        <input id={`v-${key}`} className="input" value={String(draft[key])} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} {...props} />
        {errors[key] ? <p className="field-error">{errors[key]}</p> : hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
      </div>
    );

  const discountText = (c: CouponView) =>
    c.type === 'FREE_SHIPPING'
      ? c.value > 0
        ? `Delivery up to ${money(c.value)}`
        : 'Free delivery'
      : c.type === 'PERCENTAGE'
        ? `${c.value}%${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ''}`
        : money(c.value);

  return (
    <div>
      <PageHeader
        title={admin ? 'Vouchers' : 'Shop vouchers'}
        description={
          admin
            ? 'Platform-wide, shop-specific and payment-method vouchers. Customers collect them in the Voucher Center.'
            : 'Vouchers for your shop only. Discounts come off your items (free delivery comes off your delivery fee).'
        }
        actions={
          <Button onClick={() => setDraft(blank())}>
            <Plus className="size-4" /> Voucher
          </Button>
        }
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Voucher', 'Discount', 'Min spend', 'Used', 'Valid', 'Status', '']} empty={data?.length ? undefined : 'No vouchers yet'}>
            {data?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <b>{c.code}</b>
                  <br />
                  <span className="text-xs text-ink-500">{voucherKind(c)}</span>
                  {c.description && <span className="block text-xs text-ink-400">{c.description}</span>}
                </td>
                <td className="px-4 py-3">{discountText(c)}</td>
                <td className="px-4 py-3">{money(c.minOrderAmount)}</td>
                <td className="px-4 py-3">
                  {c.usedCount}
                  {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                </td>
                <td className="px-4 py-3 text-xs">
                  {fmtDate(c.startsAt)}
                  <br />→ {fmtDate(c.endsAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={c.isActive && new Date(c.endsAt) > new Date() ? 'success' : 'neutral'}>
                    {!c.isActive ? 'Off' : new Date(c.endsAt) <= new Date() ? 'Ended' : 'Active'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(fromView(c))} aria-label={`Edit ${c.code}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(c)} aria-label={`Delete ${c.code}`}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? 'Edit voucher' : 'New voucher'} size="lg">
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            {admin && (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="v-scope">Voucher kind</label>
                <select id="v-scope" className="input" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as CouponScope })}>
                  {COUPON_SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {SCOPE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {admin && draft.scope === 'STORE' && (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="v-seller">Shop</label>
                <select id="v-seller" className="input" value={draft.sellerId} onChange={(e) => setDraft({ ...draft, sellerId: e.target.value })}>
                  <option value="">Choose a shop…</option>
                  {sellers?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shopName}
                      {s.isHouseStore ? ' (house store)' : ''}
                    </option>
                  ))}
                </select>
                {errors.sellerId && <p className="field-error">{errors.sellerId}</p>}
              </div>
            )}
            {admin && draft.scope === 'PAYMENT' && (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="v-method">Payment method</label>
                <select
                  id="v-method"
                  className="input"
                  value={draft.paymentMethod}
                  onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value as PaymentMethod | '' })}
                >
                  <option value="">Choose a method…</option>
                  {ONLINE_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {errors.paymentMethod && <p className="field-error">{errors.paymentMethod}</p>}
              </div>
            )}
            {field('code', 'Code', { className: 'input uppercase placeholder:normal-case', placeholder: 'e.g. EID10' })}
            <div>
              <label className="label" htmlFor="v-type">Type</label>
              <select
                id="v-type"
                className="input"
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value as CouponType;
                  setDraft({ ...draft, type, value: type === 'FREE_SHIPPING' ? '0' : draft.value === '0' ? '10' : draft.value });
                }}
              >
                {COUPON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            {field(
              'value',
              draft.type === 'PERCENTAGE' ? 'Percent off' : draft.type === 'FIXED' ? 'Amount off (৳)' : 'Delivery discount cap (৳)',
              { inputMode: 'decimal' },
              draft.type === 'FREE_SHIPPING' ? '0 covers the whole delivery fee' : undefined,
            )}
            {draft.type === 'PERCENTAGE' ? field('maxDiscount', 'Max discount (৳, optional)', { inputMode: 'decimal' }) : <div />}
            {field('minOrderAmount', 'Minimum spend (৳)', { inputMode: 'decimal' }, draft.scope === 'STORE' || !admin ? "Counts this shop's items only" : undefined)}
            {field('usageLimit', 'Total uses (optional)', { inputMode: 'numeric' })}
            {field('perUserLimit', 'Uses per customer', { inputMode: 'numeric' })}
            {field('description', 'Description (shown to customers)')}
            {field('startsAt', 'Starts', { type: 'datetime-local' })}
            {field('endsAt', 'Ends', { type: 'datetime-local' })}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary-700" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
            </label>
            <Button className="sm:col-span-2" loading={saving} onClick={() => void submit()}>
              Save
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
