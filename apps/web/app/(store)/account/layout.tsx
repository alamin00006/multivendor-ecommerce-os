'use client';

import { selectUser, useChatLive, useChatUnreadQuery, useLogoutMutation, useMarketplaceMode } from '@marketbd/api-client';
import {
  Ban,
  Bell,
  BookUser,
  Heart,
  LogOut,
  type LucideIcon,
  MessageCircle,
  Package,
  RotateCcw,
  Star,
  Store,
  Ticket,
  TicketCheck,
  User,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RequireAuth, useI18n, cn } from '@marketbd/ui';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  /** Sub-items render smaller and lighter, under their group heading. */
  sub?: boolean;
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const { sellerFeatures } = useMarketplaceMode();
  const [logout] = useLogoutMutation();
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('customer', { skip: !user, pollingInterval: chatLive ? 0 : 30_000 });
  const verified = Boolean(user?.phoneVerified || user?.emailVerified);

  // Grouped like the reference: account, vouchers, orders, then the rest.
  const groups: NavLink[][] = [
    [
      { href: '/account', label: 'Manage My Account', icon: User, exact: true },
      { href: '/account/profile', label: 'My Profile', icon: UserRound, sub: true },
      { href: '/account/addresses', label: 'Address Book', icon: BookUser, sub: true },
    ],
    [
      { href: '/account/vouchers', label: 'Voucher Center', icon: Ticket },
      { href: '/account/my-vouchers', label: 'My Voucher', icon: TicketCheck },
    ],
    [
      { href: '/account/orders', label: 'My Orders', icon: Package },
      { href: '/account/returns', label: 'My Returns', icon: RotateCcw, sub: true },
      { href: '/account/cancellations', label: 'My Cancellations', icon: Ban, sub: true },
    ],
    [
      { href: '/account/reviews', label: 'My Reviews', icon: Star },
      { href: '/account/wishlist', label: 'My Wishlist', icon: Heart },
      { href: '/account/messages', label: 'Messages', icon: MessageCircle, badge: chatUnread?.count },
      { href: '/account/notifications', label: t.common.notifications, icon: Bell },
      ...(sellerFeatures && user?.role === 'CUSTOMER' ? [{ href: '/sell', label: t.account.becomeSeller, icon: Store }] : []),
    ],
  ];
  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <div className="container-site pt-4">
      <RequireAuth>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit min-w-0 rounded-lg bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 pb-3 lg:block">
              <div className="min-w-0">
                <p className="text-xs text-ink-500">Hello,</p>
                <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
              </div>
              {verified && (
                <span className="mt-0 inline-block rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-success lg:mt-2">Verified Account</span>
              )}
            </div>

            {/* Phones: one scrollable row. Desktop: grouped list. */}
            <nav className="scrollbar-none -mx-1 mt-2 flex gap-1 overflow-x-auto lg:mx-0 lg:block">
              {groups.map((group, gi) => (
                <div key={gi} className="flex shrink-0 gap-1 lg:block lg:border-b lg:border-ink-100 lg:py-2 lg:last:border-0">
                  {group.map((l) => {
                    const active = isActive(l);
                    const Icon = l.icon;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 transition',
                          l.sub ? 'text-sm lg:pl-2' : 'text-[15px]',
                          active ? 'font-semibold text-accent-600 max-lg:bg-accent-50' : l.sub ? 'text-ink-500 hover:text-ink-900' : 'text-ink-800 hover:text-accent-600',
                        )}
                      >
                        <Icon className={cn('shrink-0', l.sub ? 'size-3.5' : 'size-4')} /> {l.label}
                        {l.badge ? <span className="ml-auto rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{l.badge}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
              <button
                type="button"
                onClick={() => void logout()}
                className="flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[15px] text-ink-800 hover:text-danger lg:mt-1"
              >
                <LogOut className="size-4" /> {t.common.signOut}
              </button>
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </RequireAuth>
    </div>
  );
}
