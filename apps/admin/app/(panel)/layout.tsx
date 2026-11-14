'use client';

import { useMarketplaceMode } from '@marketbd/api-client';
import {
  BadgePercent,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  ListTree,
  Megaphone,
  MessageCircleQuestion,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Users,
  Zap,
} from 'lucide-react';
import { type NavItem, PanelLayout } from '@marketbd/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { multiVendor } = useMarketplaceMode();
  const nav: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/returns', label: 'Returns', icon: RotateCcw },
    { href: '/products', label: multiVendor ? 'Products' : 'Store products', icon: Package },
    ...(multiVendor ? [{ href: '/sellers', label: 'Sellers', icon: Store }] : []),
    { href: '/users', label: 'Users', icon: Users },
    { href: '/categories', label: 'Categories', icon: ListTree },
    { href: '/brands', label: 'Brands', icon: Tags },
    { href: '/banners', label: 'Home banners', icon: ImageIcon },
    { href: '/quick-links', label: 'Quick links', icon: Link2 },
    { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { href: '/flash-sales', label: 'Flash sales', icon: Zap },
    { href: '/coupons', label: 'Coupons', icon: BadgePercent },
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
