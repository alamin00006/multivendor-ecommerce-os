'use client';

import {
  errorMessage,
  selectUser,
  useAddressesQuery,
  useAvailableCouponsQuery,
  useCheckoutPreviewQuery,
  useInitiatePaymentMutation,
  usePlaceOrderMutation,
  usePublicSettingsQuery,
  useRemoveCartItemMutation,
  useUpdateCartItemMutation,
} from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import type { CouponView, OnlinePaymentMethod, PaymentMethod } from '@marketbd/shared';
import { Banknote, BadgeCheck, Check, ChevronDown, ChevronRight, CreditCard, MapPin, Plus, ShieldCheck, Smartphone, Ticket, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressForm } from '@/components/forms/address-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { RequireAuth, useI18n, Button, cn, ErrorState, Modal, QuantityStepper, Skeleton, VoucherCard } from '@marketbd/ui';
import { useSelector } from 'react-redux';

const MAX_ADDRESSES = 10;
const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { COD: Banknote, BKASH: Smartphone, SSLCOMMERZ: CreditCard, CASH: Banknote };
// Card and wallet payments first, cash last — like the reference layout.
const METHOD_ORDER: OnlinePaymentMethod[] = ['SSLCOMMERZ', 'BKASH', 'COD'];
const ACCEPTED = ['AMEX', 'Mastercard', 'VISA', 'bKash', 'Nagad', 'Rocket', 'Upay', 'COD'];

function Row({ label, value, tone }: { label: string; value: string; tone?: 'discount' }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 py-3 text-sm last:border-0">
      <span className="text-ink-700">{label}</span>
      <span className={cn('font-semibold', tone === 'discount' ? 'text-accent-600' : 'text-ink-900')}>{value}</span>
    </div>
  );
}

function Checkout() {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const { data: addresses, isLoading: loadingAddresses } = useAddressesQuery();
  const { data: settings } = usePublicSettingsQuery();
  const user = useSelector(selectUser);
  const { data: allVouchers } = useAvailableCouponsQuery(user?.id);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<OnlinePaymentMethod>('COD');
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [picker, setPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [voucherList, setVoucherList] = useState(false);

  const selectedId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id ?? null;
  const address = addresses?.find((a) => a.id === selectedId) ?? null;
  // The chosen method is sent so payment vouchers (e.g. bKash only) are checked live.
  const { data: preview, isFetching, isError, refetch } = useCheckoutPreviewQuery({ addressId: selectedId ?? undefined, couponCode: coupon, paymentMethod: method });
  const [placeOrder, placing] = usePlaceOrderMutation();
  const [initiate] = useInitiatePaymentMutation();
  const [updateItem] = useUpdateCartItemMutation();
  const [removeItem] = useRemoveCartItemMutation();

  const items = preview?.groups.flatMap((g) => g.items) ?? [];
  const lineCount = items.length;
  // Store vouchers only for shops in this order; collected vouchers first.
  const shopIds = preview?.groups.map((g) => g.seller?.id).filter((id): id is string => Boolean(id)) ?? [];
  const vouchers = (allVouchers ?? [])
    .filter((v) => v.scope !== 'STORE' || !v.seller || shopIds.length === 0 || shopIds.includes(v.seller.id))
    .sort((a, b) => Number(b.collected) - Number(a.collected));
  /** Why a voucher cannot be applied to this order yet (null = it can). */
  const blocker = (v: CouponView) => {
    const base = v.scope === 'STORE' ? (preview?.groups.find((g) => g.seller?.id === v.seller?.id)?.subtotal ?? 0) : (preview?.subtotal ?? 0);
    if (base < v.minOrderAmount) return `Add ${money(v.minOrderAmount - base)} more`;
    if (v.scope === 'PAYMENT' && v.paymentMethod && v.paymentMethod !== method) return `Pay with ${t.checkout.methods[v.paymentMethod]}`;
    return null;
  };
  // List price before product discounts, so the summary can show the saving on its own line.
  const listSubtotal = items.reduce((s, i) => s + Math.max(i.compareAtPrice ?? i.unitPrice, i.unitPrice) * i.quantity, 0);
  const productDiscount = listSubtotal - (preview?.subtotal ?? 0);
  const methods = [...(preview?.paymentMethods ?? [{ method: 'COD' as const, enabled: true }])].sort(
    (a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
  );
  const recommended = methods.find((m) => m.enabled && m.method !== 'COD')?.method;
  const eta = preview?.shippingZone === 'OUTSIDE_DHAKA' ? settings?.shipping.outsideDhakaEta : settings?.shipping.insideDhakaEta;

  const applyCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    setCouponInput(clean);
    setCoupon(clean || undefined);
  };

  const submit = async () => {
    if (!selectedId) return setAdding(true);
    if (!agreed) return toast.error('Please accept the terms to place your order');
    try {
      const result = await placeOrder({ addressId: selectedId, paymentMethod: method, couponCode: preview?.coupon?.code, note: note || undefined, client: 'web' }).unwrap();
      if (method === 'COD') {
        router.replace(`/checkout/result?status=success&order=${result.order.id}`);
        return;
      }
      const redirect = result.payment?.redirectUrl ?? (await initiate({ orderId: result.order.id, client: 'web' }).unwrap()).redirectUrl;
      if (redirect) window.location.assign(redirect);
      else router.replace(`/checkout/result?status=failed&order=${result.order.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (isError) return <ErrorState message={t.common.error} onRetry={() => void refetch()} />;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* ───────── Left: items + payment ───────── */}
      <div className="min-w-0 space-y-6">
        <section>
          <h1 className="mb-3 text-xl font-semibold text-ink-900">Order items ({lineCount})</h1>
          {!preview && isFetching ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-4">
              {preview?.groups.map((g, gi) => (
                <div key={g.seller?.id ?? gi} className="card overflow-hidden">
                  <p className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 font-semibold">
                    {g.seller ? g.seller.shopName : `${t.checkout.package} ${gi + 1}`}
                    {g.seller?.isHouseStore && (
                      <span className="flex items-center gap-0.5 rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        <BadgeCheck className="size-3" /> Official store
                      </span>
                    )}
                  </p>
                  <ul className="divide-y divide-ink-100 px-4">
                    {g.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                        <Link href={`/p/${item.product.slug}`} className="relative size-14 shrink-0 overflow-hidden rounded bg-ink-50">
                          {item.product.imageUrl && <Image src={item.product.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                        </Link>
                        <div className="min-w-0 basis-[calc(100%-4.25rem)] text-sm sm:flex-1 sm:basis-auto">
                          <p className="line-clamp-2 text-ink-800 sm:line-clamp-1">{pick(item.product.title, item.product.titleBn)}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {Object.values(item.variant.attributes).length > 0 && (
                              <span className="rounded-full bg-ink-50 px-2 py-0.5 font-medium text-ink-700">{Object.values(item.variant.attributes).join(', ')}</span>
                            )}
                            {g.seller && (
                              <span className="text-accent-600">{g.seller.isHouseStore ? `Sold & shipped by ${BRAND.name}` : `Sold by ${g.seller.shopName}`}</span>
                            )}
                          </p>
                        </div>
                        {/* On phones the controls drop to their own row under the title. */}
                        <div className="flex w-full items-center justify-between gap-3 pl-[4.25rem] sm:w-auto sm:pl-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void removeItem(item.id)}
                            className="grid size-8 place-items-center rounded border border-ink-200 text-flash hover:bg-ink-50"
                            aria-label={t.cart.remove}
                          >
                            <Trash2 className="size-4" />
                          </button>
                          <QuantityStepper
                            value={item.quantity}
                            max={Math.max(1, Math.min(item.variant.stock, 20))}
                            onChange={(q) => void updateItem({ id: item.id, quantity: q })}
                          />
                        </div>
                        <div className="w-24 text-right">
                          <p className="text-lg font-bold text-accent-600">{money(item.lineTotal)}</p>
                          {item.compareAtPrice && item.compareAtPrice > item.unitPrice && (
                            <p className="text-xs text-ink-400 line-through">{money(item.compareAtPrice * item.quantity)}</p>
                          )}
                        </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm">
                    <span>
                      {g.delivery.by === 'SHOP' ? `Delivered by the shop · ${g.delivery.courier}` : 'Standard Delivery'}{' '}
                      {(g.delivery.eta ?? eta) && <span className="text-xs text-primary-700">Receive within {g.delivery.eta ?? eta}</span>}
                    </span>
                    <span className="font-semibold text-success">{selectedId ? `Fee ${money(g.shippingFee)}` : 'Add an address'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink-900">Select Payment Method</h2>
            <ShieldCheck className="size-6 fill-success text-white" aria-label="Secure payment" />
          </div>
          <div className="card divide-y divide-ink-100 px-4">
            {methods.map(({ method: m, enabled, note }) => {
              const Icon = METHOD_ICON[m];
              const on = method === m;
              return (
                <label
                  key={m}
                  className={cn('flex cursor-pointer items-center gap-4 py-4', !enabled && 'cursor-not-allowed opacity-50')}
                >
                  <input
                    type="radio"
                    name="payment"
                    className="size-5 accent-primary-700"
                    checked={on}
                    disabled={!enabled}
                    onChange={() => setMethod(m)}
                  />
                  <Icon className="size-7 shrink-0 text-accent-600" />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{t.checkout.methods[m]}</span>
                    {!enabled && <span className="text-xs text-ink-500">{note ?? t.checkout.unavailableMethod}</span>}
                  </span>
                  {m === recommended && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Recommended</span>}
                </label>
              );
            })}
          </div>
          <label className="mt-4 block">
            <span className="label">{t.checkout.note}</span>
            <textarea className="input h-20 bg-white py-2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </section>
      </div>

      {/* ───────── Right: address + summary ───────── */}
      <aside className="contents lg:sticky lg:top-32 lg:block lg:space-y-4">
        <section className="card order-first p-5 lg:order-none">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink-900">Delivery to</h2>
            {address && (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="flex items-center gap-1 rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100"
              >
                Change <ChevronDown className="size-3.5" />
              </button>
            )}
          </div>
          {loadingAddresses ? (
            <Skeleton className="h-16" />
          ) : address ? (
            <div className="text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">{address.label}</span>
                <span className="font-semibold text-ink-900">{address.fullName}</span>
                <span className="text-ink-700">{address.phone}</span>
              </p>
              <p className="mt-2 text-ink-500">{address.addressLine}</p>
              <p className="text-base text-ink-800">
                {pick(address.area.name, address.area.nameBn)}, {pick(address.district.name, address.district.nameBn)}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-200 py-5 text-sm text-ink-500 hover:border-primary-400 hover:text-primary-700"
            >
              <MapPin className="size-4" /> {t.checkout.noAddress}
            </button>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 border-b border-ink-100 pb-3 text-xl font-semibold text-ink-900">Order Summary</h2>
          <Row label="Product Subtotal:" value={money(listSubtotal)} />
          {productDiscount > 0 && <Row label="Product Discount:" value={`-${money(productDiscount)}`} tone="discount" />}
          <Row label="Delivery Fee:" value={selectedId ? money(preview?.shippingFee ?? 0) : '—'} />
          {(preview?.discount ?? 0) > 0 && (
            <Row
              label={`${preview!.coupon?.appliesTo === 'shipping' ? 'Delivery Discount' : 'Voucher'} (${preview!.coupon?.code}):`}
              value={`-${money(preview!.discount)}`}
              tone="discount"
            />
          )}
          <div className="flex items-center justify-between pt-3">
            <span className="text-lg text-ink-900">Total:</span>
            <span className="text-2xl font-bold text-accent-600">{money(preview?.total ?? 0)}</span>
          </div>

          {vouchers && vouchers.length > 0 && (
            <button
              type="button"
              onClick={() => setVoucherList(true)}
              className="mt-4 flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-3 text-sm"
            >
              <span className="flex items-center gap-2 font-semibold text-amber-700">
                <Ticket className="size-5" /> Vouchers <ChevronRight className="size-4" />
              </span>
              {(preview?.discount ?? 0) > 0 ? (
                <span className="text-amber-700">
                  Saved <b>{money(preview!.discount)}</b>
                </span>
              ) : (
                <span className="text-xs text-amber-700">{vouchers.length} available</span>
              )}
            </button>
          )}

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold">Have a {BRAND.name} Coupon?</p>
            <form
              className="flex overflow-hidden rounded-lg border border-ink-200 focus-within:border-primary-600"
              onSubmit={(e) => {
                e.preventDefault();
                applyCode(couponInput);
              }}
            >
              <input
                className="min-w-0 flex-1 px-3 py-2.5 text-sm uppercase outline-none placeholder:normal-case"
                placeholder="Enter coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                aria-label={t.checkout.coupon}
              />
              <button type="submit" className="m-1 rounded-md bg-primary-50 px-5 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                {t.checkout.applyCoupon}
              </button>
            </form>
            {preview?.couponError && <p className="field-error">{preview.couponError}</p>}
            {preview?.coupon && (
              <p className="mt-1 flex items-center justify-between text-xs text-success">
                ✓ {preview.coupon.code} applied
                <button type="button" onClick={() => applyCode('')} className="text-ink-500 hover:text-danger">
                  Remove
                </button>
              </p>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer gap-2 text-xs text-ink-600">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary-700" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to the{' '}
              <Link href="/help/terms" className="text-primary-700 hover:underline">Terms &amp; Conditions</Link>,{' '}
              <Link href="/help/privacy" className="text-primary-700 hover:underline">Privacy Policy</Link> and{' '}
              <Link href="/help/returns" className="text-primary-700 hover:underline">Return &amp; Refund Policy</Link> of {BRAND.name}
            </span>
          </label>

          {preview && preview.blockedItems > 0 && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">{t.cart.blocked}</p>}

          <button
            type="button"
            disabled={placing.isLoading || !preview || preview.groups.length === 0 || preview.blockedItems > 0 || !agreed}
            onClick={() => void submit()}
            className="mt-5 h-12 w-full rounded-lg bg-accent-500 text-lg font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placing.isLoading ? t.checkout.placing : method === 'COD' ? 'Place Order' : 'Order & Pay'}
          </button>
        </section>

        <div className="space-y-2.5 px-1 text-sm text-ink-600">
          <p className="flex items-center gap-2 font-semibold text-success">
            <ShieldCheck className="size-5" /> {BRAND.name} protects your payment information
          </p>
          {[
            'Card payments go through a PCI DSS compliant gateway',
            'Card information is secure and uncompromised',
            'All data is encrypted',
            `${BRAND.name} never sells your payment information`,
          ].map((line) => (
            <p key={line} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> {line}
            </p>
          ))}
        </div>

        <div className="card flex flex-wrap items-center gap-2 px-5 py-3">
          <span className="mr-1 font-semibold text-ink-900">We Accept</span>
          {ACCEPTED.map((p) => (
            <span key={p} className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700">
              {p}
            </span>
          ))}
        </div>
      </aside>

      {/* ───────── Modals ───────── */}
      <Modal open={picker} onClose={() => setPicker(false)} title={`Delivery address (${addresses?.length ?? 0}/${MAX_ADDRESSES})`}>
        <ul className="space-y-2">
          {addresses?.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  setAddressId(a.id);
                  setPicker(false);
                }}
                className={cn('w-full rounded-lg border-2 p-3 text-left text-sm', a.id === selectedId ? 'border-primary-700 bg-primary-50' : 'border-ink-100 hover:border-ink-300')}
              >
                <p className="font-semibold">
                  <span className="mr-2 rounded-full bg-white px-2 py-0.5 text-xs text-primary-700">{a.label}</span>
                  {a.fullName} · {a.phone}
                </p>
                <p className="mt-1 text-ink-600">
                  {a.addressLine}, {pick(a.area.name, a.area.nameBn)}, {pick(a.district.name, a.district.nameBn)}
                </p>
              </button>
            </li>
          ))}
        </ul>
        {(addresses?.length ?? 0) < MAX_ADDRESSES && (
          <Button
            variant="outline"
            block
            className="mt-3"
            onClick={() => {
              setPicker(false);
              setAdding(true);
            }}
          >
            <Plus className="size-4" /> {t.checkout.addAddress}
          </Button>
        )}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.checkout.addAddress} size="lg">
        <AddressForm
          onSaved={(a) => {
            setAddressId(a.id);
            setAdding(false);
          }}
        />
      </Modal>

      <Modal open={voucherList} onClose={() => setVoucherList(false)} title="Vouchers" size="lg">
        <p className="mb-3 text-xs text-ink-500">One voucher per order. Collected vouchers are listed first.</p>
        <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {vouchers.map((v) => {
            const reason = blocker(v);
            const applied = preview?.coupon?.code === v.code;
            return (
              <li key={v.id}>
                <VoucherCard
                  voucher={v}
                  action={
                    reason && !applied ? (
                      <span className="text-xs font-semibold text-ink-500">{reason}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          applyCode(applied ? '' : v.code);
                          setVoucherList(false);
                        }}
                        className={applied ? 'rounded-md border border-ink-300 bg-white px-4 py-1 text-xs font-semibold text-ink-700' : 'rounded-md bg-primary-700 px-4 py-1 text-xs font-semibold text-white hover:bg-primary-800'}
                      >
                        {applied ? 'Remove' : 'Apply'}
                      </button>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}

export default function CheckoutPage() {
  const { t } = useI18n();
  return (
    <div className="container-site pt-3">
      <Breadcrumbs items={[{ label: t.common.cart, href: '/cart' }, { label: t.checkout.title }]} />
      <RequireAuth>
        <Checkout />
      </RequireAuth>
    </div>
  );
}
