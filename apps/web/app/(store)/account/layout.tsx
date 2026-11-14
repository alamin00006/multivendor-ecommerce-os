'use client';

import { selectUser, useLogoutMutation, useMarketplaceMode } from '@marketbd/api-client';
import { Bell, Heart, LogOut, MapPin, Package, Store, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RequireAuth, useI18n, cn } from '@marketbd/ui';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const { sellerFeatures } = useMarketplaceMode();
  const [logout] = useLogoutMutation();
  const links = [
    { href: '/account', label: t.account.profile, icon: User, exact: true },
    { href: '/account/orders', label: t.common.orders, icon: Package },
    { href: '/account/addresses', label: t.account.addresses, icon: MapPin },
    { href: '/account/wishlist', label: t.common.wishlist, icon: Heart },
    { href: '/account/notifications', label: t.common.notifications, icon: Bell },
    ...(sellerFeatures && user?.role === 'CUSTOMER' ? [{ href: '/sell', label: t.account.becomeSeller, icon: Store }] : []),
  ];
  return (
    <div className="container-site pt-4">
      <RequireAuth>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <aside className="card h-fit p-2">
            <p className="truncate px-3 py-2 text-sm font-semibold">{user?.name}</p>
            <nav className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col">
              {links.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm',
                      active ? 'bg-primary-50 font-semibold text-primary-800' : 'text-ink-600 hover:bg-ink-50',
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void logout()}
                className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-red-50"
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
