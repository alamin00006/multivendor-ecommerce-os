'use client';

import {
  errorMessage,
  useAddressesQuery,
  useCheckoutPreviewQuery,
  useInitiatePaymentMutation,
  usePlaceOrderMutation,
  usePublicSettingsQuery,
  useUpdateCartItemMutation,
} from '@marketbd/api-client';
import type { PaymentMethod } from '@marketbd/shared';
import { Banknote, BadgeCheck, Check, CreditCard, MapPin, Plus, ShieldCheck, Smartphone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressForm } from '@/components/forms/address-form';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { RequireAuth, useI18n, Badge, cn, ErrorState, Modal, QuantityStepper, Skeleton } from '@marketbd/ui';

const MAX_ADDRESSES = 10;
const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { COD: Banknote, BKASH: Smartphone, SSLCOMMERZ: CreditCard };
const METHOD_HINT: Record<PaymentMethod, string> = {
  SSLCOMMERZ: 'Visa, Mastercard, Amex, Nagad, Rocket, Upay & more',
  BKASH: 'Pay from your bKash account',
  COD: 'Pay in cash when your package arrives',
};
// Card and wallet payments first, cash last — like the reference layout.
const METHOD_ORDER: PaymentMethod[] = ['SSLCOMMERZ', 'BKASH', 'COD'];
const ACCEPTED = ['AMEX', 'Mastercard', 'VISA', 'bKash', 'Nagad', 'Rocket', 'Upay', 'COD'];

function Checkout() {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const { data: addresses, isLoading: loadingAddresses } = useAddressesQuery();
  const { data: settings } = usePublicSettingsQuery();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>('COD');
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [adding, setAdding] = useState(false);

  const selectedId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id ?? null;
  const { data: preview, isFetching, isError, refetch } = useCheckoutPreviewQuery({ addressId: selectedId ?? undefined, couponCode: coupon });
  const [placeOrder, placing] = usePlaceOrderMutation();
  const [initiate] = useInitiatePaymentMutation();
  const [updateItem] = useUpdateCartItemMutation();

  const itemCount = preview?.groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.quantity, 0), 0) ?? 0;
  const methods = [...(preview?.paymentMethods ?? [{ method: 'COD' as const, enabled: true }])].sort(
    (a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
  );
  const visibleAddresses = showAll ? addresses : addresses?.filter((a) => a.id === selectedId).concat(addresses.filter((a) => a.id !== selectedId).slice(0, 1));
  const eta = preview?.shippingZone === 'OUTSIDE_DHAKA' ? settings?.shipping.outsideDhakaEta : settings?.shipping.insideDhakaEta;

  const submit = async () => {
    if (!selectedId) {
      setAdding(true);
      return;
    }
    if (!agreed) {
      toast.error('Please accept the terms to place your order');
      return;
    }
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
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {/* ── Delivery address ── */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900">
              Select a delivery address ({addresses?.length ?? 0}/{MAX_ADDRESSES})
            </h2>
            {(addresses?.length ?? 0) < MAX_ADDRESSES && (
              <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-semibold text-accent-600 hover:underline">
                <Plus className="size-4" /> Add address
              </button>
            )}
          </div>
          {loadingAddresses ? (
            <Skeleton className="h-20" />
          ) : !addresses?.length ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-ink-200 py-6 text-sm text-ink-500 hover:border-primary-400 hover:text-primary-700"
            >
              <MapPin className="size-5" /> {t.checkout.noAddress}
            </button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleAddresses?.map((a) => {
                const on = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAddressId(a.id)}
                    aria-pressed={on}
                    className={cn(
                      'relative rounded-lg border-2 p-3 text-left text-sm transition',
                      on ? 'border-primary-700 bg-primary-50/60' : 'border-ink-100 hover:border-ink-300',
                    )}
                  >
                    {on && (
                      <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary-700 text-white">
                        <Check className="size-3.5" />
                      </span>
                    )}
                    <p className="pr-6 font-semibold">
                      {a.fullName} <Badge className="ml-1">{a.label}</Badge>
                    </p>
                    <p className="text-ink-500">{a.phone}</p>
                    <p className="mt-1 line-clamp-2 text-ink-600">
                      {a.addressLine}, {pick(a.area.name, a.area.nameBn)}, {pick(a.district.name, a.district.nameBn)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          {(addresses?.length ?? 0) > 2 && (
            <div className="mt-3 text-center">
              <button type="button" onClick={() => setShowAll(!showAll)} className="text-sm font-medium text-primary-700 hover:underline">
                {showAll ? 'Show less' : `Show all (${addresses!.length})`}
              </button>
            </div>
          )}
        </section>

        {/* ── Items ── */}
        <section className="card p-5">
          <h2 className="mb-4 border-b border-ink-100 pb-3 text-lg font-semibold text-ink-900">Order summary – {itemCount} items</h2>
          <div className="mb-3 hidden grid-cols-[minmax(0,1fr)_110px_120px_100px] rounded-md bg-amber-50 px-3 py-2.5 text-sm font-medium text-ink-700 md:grid">
            <span>Product details</span>
            <span>Price</span>
            <span className="text-center">QTY</span>
            <span className="text-right">Total</span>
          </div>
          {!preview && isFetching ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-3">
              {preview?.groups.map((g, gi) => (
                <div key={g.seller?.id ?? gi} className="rounded-lg border border-ink-100 px-3">
                  <p className="flex items-center gap-2 border-b border-ink-100 py-2.5 text-sm font-medium">
                    {g.seller ? g.seller.shopName : `${t.checkout.package} ${gi + 1}`}
                    {g.seller?.isHouseStore && (
                      <span className="flex items-center gap-0.5 rounded bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        <BadgeCheck className="size-3" /> Official store
                      </span>
                    )}
                    {preview.groups.length > 1 && (
                      <span className="ml-auto text-xs font-normal text-ink-400">
                        {t.checkout.package} {gi + 1} of {preview.groups.length}
                      </span>
                    )}
                  </p>
                  <ul className="divide-y divide-ink-100">
                    {g.items.map((item) => (
                      <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 md:grid-cols-[minmax(0,1fr)_110px_120px_100px]">
                        <div className="flex min-w-0 gap-3">
                          <Link href={`/p/${item.product.slug}`} className="relative size-14 shrink-0 overflow-hidden rounded border border-ink-100 bg-ink-50">
                            {item.product.imageUrl && <Image src={item.product.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                          </Link>
                          <div className="min-w-0 text-sm">
                            <p className="line-clamp-2 text-ink-800">{pick(item.product.title, item.product.titleBn)}</p>
                            <p className="text-xs text-ink-500">
                              {Object.entries(item.variant.attributes)
                                .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}-${v}`)
                                .join(', ')}
                            </p>
                            {g.seller && <p className="text-xs text-success">Fulfilled by {g.seller.isHouseStore ? 'MarketBD' : 'Seller'}</p>}
                          </div>
                        </div>
                        <div className="hidden text-sm md:block">
                          <p className="font-semibold text-accent-600">{money(item.unitPrice)}</p>
                          {item.compareAtPrice && item.compareAtPrice > item.unitPrice && (
                            <p className="text-xs text-ink-400 line-through">{money(item.compareAtPrice)}</p>
                          )}
                        </div>
                        <div className="col-start-1 flex md:col-start-auto md:justify-center">
                          <QuantityStepper
                            value={item.quantity}
                            max={Math.max(1, Math.min(item.variant.stock, 20))}
                            onChange={(q) => void updateItem({ id: item.id, quantity: q })}
                          />
                        </div>
                        <p className="col-start-2 row-start-1 text-right text-sm font-semibold md:col-start-auto md:row-start-auto">{money(item.lineTotal)}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-ink-100 py-2.5 text-right text-sm text-ink-600">
                    {g.items.reduce((n, i) => n + i.quantity, 0)} Item(s). Subtotal: <b className="text-ink-900">{money(g.subtotal)}</b>
                  </p>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-300 px-3 py-2.5 text-sm">
                    <span className="font-medium text-primary-700">
                      Standard Delivery{eta && <span className="ml-2 text-xs font-normal text-ink-500">({eta})</span>}
                    </span>
                    <span className="font-semibold text-ink-800">{selectedId ? money(g.shippingFee) : 'Select an address'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Payment ── */}
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-semibold text-ink-900">{t.checkout.payment}</h2>
          <p className="mb-2 text-sm font-medium text-ink-700">Recommended method</p>
          <div className="space-y-2.5">
            {methods.map(({ method: m, enabled }) => {
              const Icon = METHOD_ICON[m];
              const on = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setMethod(m)}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-4 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                    on ? 'border-primary-700 bg-primary-50/60 ring-1 ring-primary-700' : 'border-ink-200 hover:border-ink-400',
                  )}
                >
                  <Icon className="size-6 shrink-0 text-accent-600" />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{t.checkout.methods[m]}</span>
                    <span className="text-xs text-ink-500">{enabled ? METHOD_HINT[m] : t.checkout.unavailableMethod}</span>
                  </span>
                  <span className={cn('grid size-5 place-items-center rounded-full border-2', on ? 'border-primary-700 bg-primary-700 text-white' : 'border-ink-300')}>
                    {on && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-5 block">
            <span className="label">{t.checkout.note}</span>
            <textarea className="input h-20 py-2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </section>
      </div>

      {/* ── Summary ── */}
      <aside className="lg:sticky lg:top-32">
        <div className="card space-y-4 p-5">
          <h2 className="border-b border-ink-100 pb-2 text-sm font-semibold">Order summary:</h2>
          <dl className="space-y-3 border-b border-ink-100 pb-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-600">Product price:</dt>
              <dd className="font-semibold">{money(preview?.subtotal ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Delivery fee:</dt>
              <dd className="font-semibold">{money(preview?.shippingFee ?? 0)}</dd>
            </div>
            {(preview?.discount ?? 0) > 0 && (
              <div className="flex justify-between text-success">
                <dt>Coupon ({preview!.coupon?.code}):</dt>
                <dd className="font-semibold">-{money(preview!.discount)}</dd>
              </div>
            )}
          </dl>
          <div className="flex justify-between">
            <span className="text-sm text-ink-700">Total payment:</span>
            <span className="text-xl font-bold text-ink-900">{money(preview?.total ?? 0)}</span>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Have a MarketBD coupon?</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setCoupon(couponInput.trim().toUpperCase() || undefined);
              }}
            >
              <input
                className="input flex-1 uppercase placeholder:normal-case"
                placeholder="Promo / Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                aria-label={t.checkout.coupon}
              />
              <button type="submit" className="rounded-md bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600">
                {t.checkout.applyCoupon}
              </button>
            </form>
            {preview?.couponError && <p className="field-error">{preview.couponError}</p>}
            {preview?.coupon && <p className="mt-1 text-xs text-success">✓ {preview.coupon.code} applied</p>}
          </div>

          <label className="flex cursor-pointer gap-2 text-xs text-ink-600">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary-700" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to the{' '}
              <Link href="/help/terms" className="text-primary-700 hover:underline">Terms &amp; Conditions</Link>,{' '}
              <Link href="/help/privacy" className="text-primary-700 hover:underline">Privacy Policy</Link> and{' '}
              <Link href="/help/returns" className="text-primary-700 hover:underline">Return &amp; Refund Policy</Link>
            </span>
          </label>

          {preview && preview.blockedItems > 0 && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{t.cart.blocked}</p>}

          <button
            type="button"
            disabled={placing.isLoading || !preview || preview.groups.length === 0 || preview.blockedItems > 0 || !agreed}
            onClick={() => void submit()}
            className="h-11 w-full rounded-full bg-gradient-to-r from-primary-700 to-accent-500 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placing.isLoading ? t.checkout.placing : method === 'COD' ? 'Place order' : 'Order & Pay'}
          </button>

          <div className="space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
              <ShieldCheck className="size-5" /> MarketBD protects your payment information
            </p>
            {[
              'Card payments are processed by a PCI DSS compliant gateway',
              'We never see or store your card number',
              'All data is encrypted in transit',
              'We never sell your payment information',
            ].map((line) => (
              <p key={line} className="flex gap-2">
                <Check className="size-3.5 shrink-0 text-success" /> {line}
              </p>
            ))}
          </div>

          <div>
            <p className="mb-2 font-semibold text-ink-900">We Accept</p>
            <div className="flex flex-wrap gap-1.5">
              {ACCEPTED.map((p) => (
                <span key={p} className="rounded border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.checkout.addAddress} size="lg">
        <AddressForm
          onSaved={(a) => {
            setAddressId(a.id);
            setAdding(false);
          }}
        />
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
