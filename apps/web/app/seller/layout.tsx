'use client';

import { LayoutDashboard, MessageCircleQuestion, Package, ShoppingBag, Store } from 'lucide-react';
import { PanelLayout } from '@marketbd/ui';

const NAV = [
  { href: '/seller', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/seller/products', label: 'Products', icon: Package },
  { href: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/seller/questions', label: 'Questions', icon: MessageCircleQuestion },
  { href: '/seller/shop', label: 'Shop settings', icon: Store },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelLayout title="Seller Center" nav={NAV} roles={['SELLER']}>
      {children}
    </PanelLayout>
  );
}
