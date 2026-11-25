'use client';

import { useCartCount, useChatLive, useChatUnreadQuery, useIsAuthenticated } from '@marketbd/api-client';
import { Bell, Home, LayoutGrid, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@marketbd/ui';

/** Mobile bottom tab bar (Home, Categories, Message, Cart, Account). */
export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const cartCount = useCartCount();
  const authed = useIsAuthenticated();
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('customer', { skip: !authed, pollingInterval: chatLive ? 0 : 30_000 });
  const items = [
    { href: '/', label: t.common.home, icon: Home, match: (p: string) => p === '/' },
    { href: '/categories', label: t.common.categories, icon: LayoutGrid, match: (p: string) => p.startsWith('/categories') || p.startsWith('/c/') },
    { href: '/account/messages', label: 'Message', icon: Bell, match: (p: string) => p.startsWith('/account/messages'), badge: chatUnread?.count },
    { href: '/cart', label: t.common.cart, icon: ShoppingCart, match: (p: string) => p.startsWith('/cart'), badge: cartCount },
    { href: '/account', label: t.common.account, icon: User, match: (p: string) => (p.startsWith('/account') && !p.startsWith('/account/messages')) || p === '/login' },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, match, badge }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-primary-700' : 'text-ink-500'}`}
              >
                <Icon className="size-5" />
                {label}
                {badge ? (
                  <span className="absolute left-1/2 top-1 ml-2 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
