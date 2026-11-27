'use client';

import { useChatLive, useChatUnreadQuery, useIsAuthenticated, useMarketplaceMode, useMeQuery } from '@marketbd/api-client';
import { adminAreaFor, hasAdminArea } from '@marketbd/shared';
import { usePathname } from 'next/navigation';
import {
  BadgePercent,
  BarChart3,
  History,
  Lock,
  Bike,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  ListTree,
  Megaphone,
  MessageCircleQuestion,
  MessageSquare,
  MessagesSquare,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingBasket,
  ShieldCheck,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { EmptyState, type NavItem, PanelLayout } from '@marketbd/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { multiVendor } = useMarketplaceMode();
  const authed = useIsAuthenticated();
  const chatLive = useChatLive();
  const pathname = usePathname();
  const { data: me } = useMeQuery(undefined, { skip: !authed });
  const permissions = me?.adminPermissions ?? [];
  const can = (href: string) => hasAdminArea(permissions, adminAreaFor(href));
  const { data: chatUnread } = useChatUnreadQuery('admin', { skip: !authed || !can('/messages'), pollingInterval: chatLive ? 0 : 30_000 });
  const all: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/pos', label: 'POS', icon: ShoppingBasket },
    { href: '/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/returns', label: 'Returns', icon: RotateCcw },
    { href: '/courier', label: 'Couriers', icon: Truck },
    { href: '/messages', label: 'Messages', icon: MessagesSquare, badge: chatUnread?.count },
    { href: '/products', label: multiVendor ? 'Products' : 'Store products', icon: Package },
    ...(multiVendor ? [{ href: '/sellers', label: 'Sellers', icon: Store }, { href: '/shop-delivery', label: 'Shop delivery', icon: Bike }, { href: '/payouts', label: 'Payouts', icon: Wallet }] : []),
    { href: '/users', label: 'Users', icon: Users },
    { href: '/categories', label: 'Categories', icon: ListTree },
    { href: '/brands', label: 'Brands', icon: Tags },
    { href: '/banners', label: 'Home banners', icon: ImageIcon },
    { href: '/quick-links', label: 'Quick links', icon: Link2 },
    { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { href: '/flash-sales', label: 'Flash sales', icon: Zap },
    { href: '/coupons', label: 'Vouchers', icon: BadgePercent },
    { href: '/reviews', label: 'Reviews', icon: MessageSquare },
    { href: '/questions', label: 'Questions', icon: MessageCircleQuestion },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/staff', label: 'Staff', icon: ShieldCheck },
    { href: '/activity', label: 'Activity log', icon: History },
  ];
  const nav = me ? all.filter((item) => can(item.href)) : all.filter((item) => item.href === '/');
  const allowed = !me || can(pathname);
  return (
    <PanelLayout title="Admin" nav={nav} roles={['ADMIN']}>
      {allowed ? (
        children
      ) : (
        <div className="card">
          <EmptyState icon={<Lock />} title="No access" text="Your staff account does not include this section. Ask a full-access admin to add it." />
        </div>
      )}
    </PanelLayout>
  );
}
