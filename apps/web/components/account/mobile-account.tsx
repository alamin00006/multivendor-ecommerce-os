'use client';

import { selectUser, useChatLive, useChatUnreadQuery, useLogoutMutation, useMarketplaceMode, useOrdersQuery } from '@marketbd/api-client';
import {
  Ban,
  Bell,
  ChevronRight,
  CircleCheck,
  FileText,
  Headphones,
  Heart,
  Hourglass,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  MapPin,
  MessageCircle,
  PackageOpen,
  RotateCcw,
  Settings,
  Star,
  Store,
  Ticket,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { OrderStatusBadge, Skeleton, useI18n } from '@marketbd/ui';
import { orderTabHref } from './orders-list';

interface Tile {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  badge?: number;
}

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-4 gap-y-4 px-2 py-4">
      {tiles.map(({ label, icon: Icon, href, onClick, badge }) => {
        const inner = (
          <>
            <span className="relative">
              <Icon className="size-6 text-ink-700" strokeWidth={1.6} />
              {badge ? (
                <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              ) : null}
            </span>
            <span className="text-center text-xs leading-tight text-ink-800">{label}</span>
          </>
        );
        const cls = 'flex flex-col items-center gap-1.5 rounded-md px-1 py-1 active:bg-ink-50';
        return href ? (
          <Link key={label} href={href} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={label} type="button" onClick={onClick} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/** Account home on phones and tablets: profile card, order shortcuts, recent orders and services. */
export function MobileAccount() {
  const { money, t } = useI18n();
  const user = useSelector(selectUser);
  const { sellerFeatures } = useMarketplaceMode();
  const [logout] = useLogoutMutation();
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('customer', { skip: !user, pollingInterval: chatLive ? 0 : 30_000 });
  const { data: orders, isLoading } = useOrdersQuery({ page: 1, limit: 3 });

  const orderTiles: Tile[] = [
    { label: 'All', icon: LayoutGrid, href: orderTabHref('all') },
    { label: 'To Pay', icon: Wallet, href: orderTabHref('to-pay') },
    { label: 'Pending', icon: Hourglass, href: orderTabHref('pending') },
    { label: 'Confirmed', icon: CircleCheck, href: orderTabHref('confirmed') },
    { label: 'To Ship', icon: PackageOpen, href: orderTabHref('to-ship') },
    { label: 'Shipped', icon: Truck, href: orderTabHref('shipped') },
    { label: 'Reviews', icon: Star, href: '/account/reviews' },
    { label: 'Cancellations', icon: Ban, href: '/account/cancellations' },
  ];
  const serviceTiles: Tile[] = [
    { label: 'Settings', icon: Settings, href: '/account/profile' },
    { label: 'Help', icon: Headphones, href: '/help' },
    { label: 'Returns', icon: RotateCcw, href: '/account/returns' },
    { label: 'Address', icon: MapPin, href: '/account/addresses' },
    { label: 'Messages', icon: MessageCircle, href: '/account/messages', badge: chatUnread?.count },
    { label: 'Notifications', icon: Bell, href: '/account/notifications' },
    { label: 'My Wishlist', icon: Heart, href: '/account/wishlist' },
    { label: 'Vouchers', icon: Ticket, href: '/account/vouchers' },
    { label: 'Policies', icon: FileText, href: '/help/returns' },
    ...(sellerFeatures && user?.role === 'CUSTOMER' ? [{ label: t.account.becomeSeller, icon: Store, href: '/sell' }] : []),
    { label: t.common.signOut, icon: LogOut, onClick: () => void logout() },
  ];

  return (
    <div className="-mx-3 space-y-2 md:mx-0">
      <h1 className="bg-white px-4 pb-1 pt-3 text-2xl font-semibold text-ink-900">Profile</h1>

      <section className="flex items-center gap-4 bg-white px-4 pb-4">
        <div className="relative shrink-0">
          {user?.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" width={88} height={88} className="size-20 rounded-full border-2 border-ink-900 object-cover" />
          ) : (
            <span className="grid size-20 place-items-center rounded-full border-[3px] border-ink-900 bg-white">
              <UserRound className="size-12 text-ink-900" strokeWidth={1.8} />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink-900">{user?.name}</p>
          {user?.phone && <p className="text-ink-500">{user.phone.replace(/^\+88/, '')}</p>}
          {user?.email && <p className="truncate text-ink-500">{user.email}</p>}
          <div className="mt-1.5 flex items-center gap-3">
            <Link href="/account/profile" className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-800">
              Edit Profile
            </Link>
            <Link href="/account/my-vouchers" className="text-xs font-medium text-ink-800 underline">
              My Voucher
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <Link href={orderTabHref('all')} className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 text-ink-800">
          <LayoutGrid className="size-5 text-ink-500" strokeWidth={1.6} />
          <span className="flex-1">My Orders</span>
          <span className="text-xs text-ink-500">View all</span>
          <ChevronRight className="size-4 text-ink-400" />
        </Link>
        <TileGrid tiles={orderTiles} />
      </section>

      <section className="bg-white">
        <p className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 text-lg text-ink-900">
          <Truck className="size-5 text-ink-500" strokeWidth={1.6} /> Track Orders
        </p>
        {isLoading ? (
          <Skeleton className="m-4 h-20" />
        ) : !orders?.items.length ? (
          <p className="px-4 py-5 text-sm text-ink-500">Your recent orders will show here.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {orders.items.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex shrink-0 -space-x-3">
                    {o.previewImages.slice(0, 2).map((src) => (
                      <Image key={src} src={src} alt="" width={44} height={44} className="size-11 rounded border-2 border-white object-cover" />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{o.orderNumber}</span>
                    <span className="block text-xs text-ink-500">
                      {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {money(o.total)}
                    </span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <ChevronRight className="size-4 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white">
        <TileGrid tiles={serviceTiles} />
      </section>
    </div>
  );
}
