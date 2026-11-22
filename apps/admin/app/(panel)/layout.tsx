'use client';

import { useChatLive, useChatUnreadQuery, useIsAuthenticated, useMarketplaceMode } from '@marketbd/api-client';
import {
  BadgePercent,
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
  ShoppingBasket,
  ShoppingBag,
  Store,
  Tags,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { type NavItem, PanelLayout } from '@marketbd/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { multiVendor } = useMarketplaceMode();
  const authed = useIsAuthenticated();
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('admin', { skip: !authed, pollingInterval: chatLive ? 0 : 30_000 });
  const nav: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/pos', label: 'POS', icon: ShoppingBasket },
    { href: '/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/returns', label: 'Returns', icon: RotateCcw },
    { href: '/messages', label: 'Messages', icon: MessagesSquare, badge: chatUnread?.count },
    { href: '/products', label: multiVendor ? 'Products' : 'Store products', icon: Package },
    ...(multiVendor ? [{ href: '/sellers', label: 'Sellers', icon: Store }, { href: '/payouts', label: 'Payouts', icon: Wallet }] : []),
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
  ];
  return (
    <PanelLayout title="Admin" nav={nav} roles={['ADMIN']}>
      {children}
    </PanelLayout>
  );
}
