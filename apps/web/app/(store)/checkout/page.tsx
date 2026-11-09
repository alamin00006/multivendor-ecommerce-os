'use client';

import {
  errorMessage,
  useAddressesQuery,
  useCheckoutPreviewQuery,
  useInitiatePaymentMutation,
  usePlaceOrderMutation,
} from '@marketbd/api-client';
import type { PaymentMethod } from '@marketbd/shared';
import { Banknote, CreditCard, MapPin, Smartphone, Store, Tag } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddressForm } from '@/components/forms/address-form';
import { RequireAuth } from '@/components/auth/require-auth';
import { useI18n } from '@/i18n/client';
import { Badge, Button, cn, ErrorState, Modal, Skeleton } from '@/components/ui';

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { COD: Banknote, BKASH: Smartphone, SSLCOMMERZ: CreditCard };

function Checkout() {
  const { t, money, pick } = useI18n();
  const router = useRouter();
  const { data: addresses, isLoading: loadingAddresses } = useAddressesQuery();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod>('COD');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const selectedId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id ?? null;
  const address = addresses?.find((a) => a.id === selectedId) ?? null;
  const { data: preview, isFetching, isError, refetch } = useCheckoutPreviewQuery({ addressId: selectedId ?? undefined, couponCode: coupon });
  const [placeOrder, placing] = usePlaceOrderMutation();
  const [initiate] = useInitiatePaymentMutation();

  const submit = async () => {
    if (!selectedId) {
      setAdding(true);
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
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="size-5 text-primary-700" /> {t.checkout.shippingAddress}
            </h2>
            {addresses && addresses.length > 0 && (
              <button type="button" className="text-sm font-semibold text-primary-700" onClick={() => setPicker(true)}>
                {t.checkout.change}
              </button>
            )}
          </div>
          {loadingAddresses ? (
            <Skeleton className="h-16" />
          ) : address ? (
            <div className="text-sm">
              <p className="font-semibold">
                {address.fullName} · {address.phone} <Badge className="ml-1">{address.label}</Badge>
              </p>
              <p className="text-ink-600">
                {address.addressLine}, {pick(address.area.name, address.area.nameBn)}, {pick(address.district.name, address.district.nameBn)},{' '}
                {pick(address.division.name, address.division.nameBn)}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              {t.checkout.noAddress}
              <Button size="sm" onClick={() => setAdding(true)}>
                {t.checkout.addAddress}
              </Button>
            </div>
          )}
        </section>

        {!preview && isFetching ? (
          <Skeleton className="h-40" />
        ) : (
          preview?.groups.map((g, i) => (
            <section key={g.seller?.id ?? i} className="card p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Store className="size-4 text-primary-700" />
                {t.checkout.package} {i + 1} of {preview.groups.length}
                {g.seller && <span className="font-normal text-ink-500">· {g.seller.shopName}</span>}
              </p>
              <ul className="divide-y divide-ink-100">
                {g.items.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded bg-ink-50">
                      {item.product.imageUrl && <Image src={item.product.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="line-clamp-1">{pick(item.product.title, item.product.titleBn)}</p>
                      <p className="text-xs text-ink-500">{Object.values(item.variant.attributes).join(' / ')}</p>
                      <p className="mt-1">
                        <span className="font-semibold text-accent-600">{money(item.unitPrice)}</span>
                        <span className="text-ink-500"> × {item.quantity}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between border-t border-ink-100 pt-2 text-xs text-ink-500">
                <span>{t.cart.shipping}</span>
                <span>{money(g.shippingFee)}</span>
              </p>
            </section>
          ))
        )}

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{t.checkout.payment}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {(preview?.paymentMethods ?? [{ method: 'COD' as const, enabled: true }]).map(({ method: m, enabled }) => {
              const Icon = METHOD_ICON[m];
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                    method === m ? 'border-primary-700 bg-primary-50' : 'border-ink-100 hover:border-ink-300',
                  )}
                >
                  <Icon className="size-5 text-primary-700" />
                  <span className="font-semibold">{t.checkout.methods[m]}</span>
                  {!enabled && <span className="text-xs text-ink-500">{t.checkout.unavailableMethod}</span>}
                </button>
              );
            })}
          </div>
          <label className="mt-4 block">
            <span className="label">{t.checkout.note}</span>
            <textarea className="input h-20 py-2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </section>
      </div>

      <aside>
        <div className="card sticky top-28 space-y-3 p-4">
          <h2 className="font-semibold">{t.cart.summary}</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCoupon(couponInput.trim().toUpperCase() || undefined);
            }}
          >
            <div className="relative flex-1">
              <Tag className="absolute left-2.5 top-3 size-4 text-ink-400" />
              <input className="input pl-8 uppercase" placeholder={t.checkout.coupon} value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
            </div>
            <Button type="submit" variant="outline">
              {t.checkout.applyCoupon}
            </Button>
          </form>
          {preview?.couponError && <p className="field-error">{preview.couponError}</p>}
          {preview?.coupon && <p className="text-xs text-success">✓ {preview.coupon.code}</p>}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">{t.cart.subtotal}</dt><dd>{money(preview?.subtotal ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t.cart.shipping}</dt><dd>{money(preview?.shippingFee ?? 0)}</dd></div>
            {(preview?.discount ?? 0) > 0 && (
              <div className="flex justify-between text-success"><dt>{t.cart.discount}</dt><dd>-{money(preview!.discount)}</dd></div>
            )}
          </dl>
          <div className="flex justify-between border-t border-ink-100 pt-3">
            <span className="font-semibold">{t.cart.total}</span>
            <span className="text-xl font-bold text-accent-600">{money(preview?.total ?? 0)}</span>
          </div>
          {preview && preview.blockedItems > 0 && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{t.cart.blocked}</p>}
          <Button
            block
            size="lg"
            variant="accent"
            loading={placing.isLoading}
            disabled={!preview || preview.groups.length === 0 || preview.blockedItems > 0}
            onClick={() => void submit()}
          >
            {placing.isLoading ? t.checkout.placing : t.checkout.placeOrder}
          </Button>
        </div>
      </aside>

      <Modal open={picker} onClose={() => setPicker(false)} title={t.checkout.shippingAddress}>
        <ul className="space-y-2">
          {addresses?.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  setAddressId(a.id);
                  setPicker(false);
                }}
                className={cn('w-full rounded-lg border-2 p-3 text-left text-sm', a.id === selectedId ? 'border-primary-700 bg-primary-50' : 'border-ink-100')}
              >
                <p className="font-semibold">{a.fullName} · {a.phone}</p>
                <p className="text-ink-600">{a.addressLine}, {a.area.name}, {a.district.name}</p>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" block className="mt-3" onClick={() => { setPicker(false); setAdding(true); }}>
          {t.checkout.addAddress}
        </Button>
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title={t.checkout.addAddress} size="lg">
        <AddressForm onSaved={(a) => { setAddressId(a.id); setAdding(false); }} />
      </Modal>
    </div>
  );
}

export default function CheckoutPage() {
  const { t } = useI18n();
  return (
    <div className="container-site pt-4">
      <h1 className="mb-3 font-display text-xl font-semibold">{t.checkout.title}</h1>
      <RequireAuth>
        <Checkout />
      </RequireAuth>
    </div>
  );
}
