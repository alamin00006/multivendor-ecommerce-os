'use client';

import { selectUser, useAddressesQuery, useMarketplaceMode, useOrdersQuery } from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import { Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useI18n, EmptyState, OrderStatusBadge, Skeleton } from '@marketbd/ui';

function Panel({ title, edit, children }: { title: string; edit: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink-900">{title}</h2>
        <Link href={edit} className="text-sm font-medium text-info hover:underline">
          Edit
        </Link>
      </div>
      {children}
    </section>
  );
}

/** "Manage My Account": profile and default address at a glance, then recent orders to track. */
export default function AccountOverviewPage() {
  const { money, pick, locale } = useI18n();
  const user = useSelector(selectUser);
  const { showSellerInfo } = useMarketplaceMode();
  const { data: addresses, isLoading: loadingAddresses } = useAddressesQuery();
  const { data: orders, isLoading: loadingOrders } = useOrdersQuery({ page: 1, limit: 5 });
  const address = addresses?.find((a) => a.isDefault) ?? addresses?.[0];

  return (
    <div className="rounded-lg bg-white p-5 shadow-card md:p-6">
      <h1 className="border-b border-ink-100 pb-4 text-2xl font-semibold text-ink-900">Manage My Account</h1>

      <div className="grid gap-6 py-6 md:grid-cols-2 md:divide-x md:divide-ink-100">
        <Panel title="Personal Profile" edit="/account/profile">
          <p className="font-semibold text-ink-900">{user?.name}</p>
          {user?.phone && <p className="mt-2 text-ink-500">{user.phone}</p>}
          {user?.email && <p className="mt-1 break-all text-ink-500">{user.email}</p>}
        </Panel>

        <div className="md:pl-6">
          <Panel title="Address Book" edit="/account/addresses">
            {loadingAddresses ? (
              <Skeleton className="h-20" />
            ) : address ? (
              <div className="text-sm">
                <p className="text-ink-500">{address.isDefault ? 'Default Delivery Address' : 'Delivery Address'}</p>
                <p className="mt-1 font-semibold text-ink-900">{address.fullName}</p>
                <p className="mt-1 text-ink-500">
                  {address.addressLine}
                  {address.landmark ? `, ${address.landmark}` : ''}
                  <br />
                  {pick(address.area.name, address.area.nameBn)}, {pick(address.district.name, address.district.nameBn)},{' '}
                  {pick(address.division.name, address.division.nameBn)}
                </p>
                <p className="mt-1 text-ink-500">{address.phone}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-500">
                No address yet.{' '}
                <Link href="/account/addresses" className="font-medium text-primary-700 hover:underline">
                  Add one
                </Link>{' '}
                for faster checkout.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <h2 className="border-b border-ink-100 pb-3 pt-2 text-2xl font-semibold text-ink-900">Track Orders</h2>
      {loadingOrders ? (
        <Skeleton className="mt-4 h-32" />
      ) : !orders?.items.length ? (
        <EmptyState icon={<Package />} title="No orders yet" text="Your recent orders will show here." />
      ) : (
        <div>
          {/* Phones: one card per order. */}
          <ul className="divide-y divide-ink-100 md:hidden">
            {orders.items.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="block py-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink-900">{o.orderNumber}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {new Date(o.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium' })} ·{' '}
                    {showSellerInfo ? o.shopNames.join(', ') : BRAND.name}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    {o.previewImages.slice(0, 4).map((src) => (
                      <Image key={src} src={src} alt="" width={40} height={40} className="size-10 rounded object-cover" />
                    ))}
                    <span className="ml-auto text-right text-sm">
                      <b className="text-ink-900">{money(o.total)}</b>
                      <span className="block text-xs font-medium text-info">Track →</span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-ink-100 text-left text-ink-900">
                <th className="px-3 py-3 font-semibold">Order No</th>
                <th className="px-3 py-3 font-semibold">Order Date</th>
                <th className="px-3 py-3 font-semibold">Shop Name</th>
                <th className="px-3 py-3 font-semibold">Item(s)</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.items.map((o) => (
                <tr key={o.id} className="align-middle">
                  <td className="px-3 py-3 font-medium text-ink-900">{o.orderNumber}</td>
                  <td className="px-3 py-3 text-ink-600">
                    {new Date(o.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium' })}
                  </td>
                  <td className="max-w-40 truncate px-3 py-3 text-ink-700">{showSellerInfo ? o.shopNames.join(', ') : BRAND.name}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1">
                      {o.previewImages.slice(0, 3).map((src) => (
                        <Image key={src} src={src} alt="" width={36} height={36} className="size-9 rounded object-cover" />
                      ))}
                      {o.itemCount > 3 && <span className="text-xs text-ink-500">+{o.itemCount - 3}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-ink-900">{money(o.total)}</td>
                  <td className="px-3 py-3 text-right">
                    <Link href={`/account/orders/${o.id}`} className="font-medium text-info hover:underline">
                      Track
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pt-3 text-right">
            <Link href="/account/orders" className="text-sm font-medium text-primary-700 hover:underline">
              View all orders →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
