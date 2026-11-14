'use client';

import { errorMessage, useMySellerProfileQuery, useUpdateShopMutation } from '@marketbd/api-client';
import { type SellerProfileView, UpdateShopSchema } from '@marketbd/shared';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ImageField, PageHeader, Badge, Button, Skeleton } from '@marketbd/ui';

export default function ShopSettingsPage() {
  const { data: shop, isLoading } = useMySellerProfileQuery();
  if (isLoading || !shop) return <Skeleton className="h-96" />;
  return <ShopForm shop={shop} />;
}

function ShopForm({ shop }: { shop: SellerProfileView }) {
  const [save, state] = useUpdateShopMutation();
  const [form, setForm] = useState({
    shopName: shop.shopName,
    description: shop.description ?? '',
    phone: shop.phone ?? '',
    pickupAddress: shop.pickupAddress ?? '',
    logoUrl: shop.logoUrl,
    bannerUrl: shop.bannerUrl,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const parsed = UpdateShopSchema.safeParse({ ...form, description: form.description || undefined, phone: form.phone || undefined });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    try {
      await save(parsed.data).unwrap();
      toast.success('Shop updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Shop settings"
        actions={
          <>
            <Badge tone="primary">Commission {shop.commissionRate}%</Badge>
            <Link href={`/shop/${shop.slug}`} target="_blank" className="text-sm font-semibold text-primary-700">View shop ↗</Link>
          </>
        }
      />
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="shopName">Shop name</label>
          <input id="shopName" className="input" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
          {errors.shopName && <p className="field-error">{errors.shopName}</p>}
        </div>
        <div>
          <label className="label" htmlFor="phone">Contact phone</label>
          <input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {errors.phone && <p className="field-error">{errors.phone}</p>}
        </div>
        <div>
          <label className="label" htmlFor="pickup">Pickup address</label>
          <input id="pickup" className="input" value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} />
          {errors.pickupAddress && <p className="field-error">{errors.pickupAddress}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">About the shop</label>
          <textarea id="description" className="input h-28 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <span className="label">Logo</span>
          <ImageField value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} folder="shops" />
        </div>
        <div>
          <span className="label">Banner</span>
          <ImageField value={form.bannerUrl} onChange={(url) => setForm({ ...form, bannerUrl: url })} folder="shops" />
        </div>
        <div className="sm:col-span-2">
          <Button loading={state.isLoading} onClick={() => void submit()}>Save</Button>
        </div>
      </div>
    </div>
  );
}
