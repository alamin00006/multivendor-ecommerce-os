'use client';

import { useMarketplaceMode } from '@marketbd/api-client';
import {
  BadgePercent,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  ListTree,
  Megaphone,
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
import { type NavItem, PanelLayout } from '@/components/manage/panel';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { multiVendor } = useMarketplaceMode();
  const nav: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/admin/returns', label: 'Returns', icon: RotateCcw },
    { href: '/admin/products', label: multiVendor ? 'Products' : 'Store products', icon: Package },
    ...(multiVendor ? [{ href: '/admin/sellers', label: 'Sellers', icon: Store }] : []),
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/categories', label: 'Categories', icon: ListTree },
    { href: '/admin/brands', label: 'Brands', icon: Tags },
    { href: '/admin/banners', label: 'Home banners', icon: ImageIcon },
    { href: '/admin/quick-links', label: 'Quick links', icon: Link2 },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
    { href: '/admin/flash-sales', label: 'Flash sales', icon: Zap },
    { href: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
    { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];
  return (
    <PanelLayout title="Admin" nav={nav} roles={['ADMIN']}>
      {children}
    </PanelLayout>
  );
}
