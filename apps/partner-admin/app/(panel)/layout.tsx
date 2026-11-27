'use client';

import { selectUser, useChatLive, useChatUnreadQuery } from '@marketbd/api-client';
import { BarChart3, FileCheck, LayoutDashboard, ShoppingBasket, MessageCircleQuestion, MessagesSquare, Package, RotateCcw, ShoppingBag, Star, Store, Ticket, Truck, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { type NavItem, PanelLayout } from '@marketbd/ui';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = useSelector(selectUser);
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('seller', { skip: user?.role !== 'SELLER', pollingInterval: chatLive ? 0 : 30_000 });
  const nav: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/pos', label: 'POS', icon: ShoppingBasket },
    { href: '/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/returns', label: 'Returns', icon: RotateCcw },
    { href: '/courier', label: 'Courier', icon: Truck },
    { href: '/earnings', label: 'Earnings', icon: Wallet },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/messages', label: 'Messages', icon: MessagesSquare, badge: chatUnread?.count },
    { href: '/reviews', label: 'Reviews', icon: Star },
    { href: '/questions', label: 'Questions', icon: MessageCircleQuestion },
    { href: '/vouchers', label: 'Vouchers', icon: Ticket },
    { href: '/shop', label: 'Shop settings', icon: Store },
    { href: '/documents', label: 'Verification', icon: FileCheck },
  ];
  return (
    <PanelLayout title="Seller Center" nav={nav} roles={['SELLER']}>
      {children}
    </PanelLayout>
  );
}
