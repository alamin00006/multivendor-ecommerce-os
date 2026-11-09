'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { errorMessage, selectUser, useMySellerProfileQuery, useRegisterSellerMutation } from '@marketbd/api-client';
import { BRAND, type SellerRegisterInput, SellerRegisterSchema } from '@marketbd/shared';
import { BadgeCheck, Clock, Store, TrendingUp, Truck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { RequireAuth } from '@/components/auth/require-auth';
import { Badge, Button, ButtonLink, Skeleton } from '@/components/ui';

function Application() {
  const user = useSelector(selectUser);
  const { data: shop, isLoading, isError } = useMySellerProfileQuery();
  const [registerSeller, state] = useRegisterSellerMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SellerRegisterInput>({ resolver: zodResolver(SellerRegisterSchema), defaultValues: { phone: user?.phone ?? '' } });

  if (isLoading) return <Skeleton className="h-64" />;
  if (shop && !isError) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <Store className="mx-auto size-12 text-primary-700" />
        <h2 className="text-lg font-semibold">{shop.shopName}</h2>
        <Badge tone={shop.status === 'APPROVED' ? 'success' : shop.status === 'PENDING' ? 'warning' : 'danger'}>{shop.status}</Badge>
        {shop.status === 'PENDING' && <p className="text-sm text-ink-600">Your application is under review. We will notify you once it is approved.</p>}
        {shop.status === 'APPROVED' && (
          <>
            <p className="text-sm text-ink-600">Your shop is approved. Sign out and sign in again if the Seller Center does not open.</p>
            <ButtonLink href="/seller">Open Seller Center</ButtonLink>
          </>
        )}
      </div>
    );
  }
  return (
    <form
      className="card grid gap-4 p-6 sm:grid-cols-2"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        try {
          await registerSeller(v).unwrap();
          toast.success('Application submitted');
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      <h2 className="text-lg font-semibold sm:col-span-2">Open your shop</h2>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="shopName">Shop name</label>
        <input id="shopName" className="input" {...register('shopName')} />
        {errors.shopName && <p className="field-error">{errors.shopName.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="phone">Business phone</label>
        <input id="phone" className="input" inputMode="tel" {...register('phone')} />
        {errors.phone && <p className="field-error">{errors.phone.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="pickupAddress">Pickup address</label>
        <input id="pickupAddress" className="input" {...register('pickupAddress')} />
        {errors.pickupAddress && <p className="field-error">{errors.pickupAddress.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">What do you sell?</label>
        <textarea id="description" className="input h-24 py-2" {...register('description')} />
      </div>
      <Button type="submit" className="sm:col-span-2" loading={state.isLoading}>
        Submit application
      </Button>
    </form>
  );
}

export default function SellPage() {
  const perks = [
    { icon: TrendingUp, title: 'Reach millions', text: 'Sell to shoppers in all 64 districts.' },
    { icon: Truck, title: 'We deliver', text: 'Hand packages to our couriers; we handle the rest.' },
    { icon: BadgeCheck, title: 'Fast payouts', text: 'Settlements every week, straight to your bank or bKash.' },
    { icon: Clock, title: 'Quick approval', text: 'Most shops are approved within 2 working days.' },
  ];
  return (
    <div className="container-site grid gap-6 pt-6 lg:grid-cols-[1fr_480px]">
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Sell on {BRAND.name}</h1>
        <p className="text-ink-600">Create your shop, list products with variants and start receiving orders.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card flex gap-3 p-4">
              <Icon className="size-6 shrink-0 text-primary-700" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-ink-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <RequireAuth>
        <Application />
      </RequireAuth>
    </div>
  );
}
