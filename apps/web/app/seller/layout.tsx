'use client';

import { selectUser, useChatLive, useChatUnreadQuery } from '@marketbd/api-client';
import { BarChart3, LayoutDashboard, ShoppingBasket, MessageCircleQuestion, MessagesSquare, Package, RotateCcw, ShoppingBag, Star, Store, Ticket, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { type NavItem, PanelLayout } from '@marketbd/ui';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = useSelector(selectUser);
  const chatLive = useChatLive();
  const { data: chatUnread } = useChatUnreadQuery('seller', { skip: user?.role !== 'SELLER', pollingInterval: chatLive ? 0 : 30_000 });
  const nav: NavItem[] = [
    { href: '/seller', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/seller/products', label: 'Products', icon: Package },
    { href: '/seller/pos', label: 'POS', icon: ShoppingBasket },
    { href: '/seller/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/seller/returns', label: 'Returns', icon: RotateCcw },
    { href: '/seller/earnings', label: 'Earnings', icon: Wallet },
    { href: '/seller/reports', label: 'Reports', icon: BarChart3 },
    { href: '/seller/messages', label: 'Messages', icon: MessagesSquare, badge: chatUnread?.count },
    { href: '/seller/reviews', label: 'Reviews', icon: Star },
    { href: '/seller/questions', label: 'Questions', icon: MessageCircleQuestion },
    { href: '/seller/vouchers', label: 'Vouchers', icon: Ticket },
    { href: '/seller/shop', label: 'Shop settings', icon: Store },
  ];
  return (
    <PanelLayout title="Seller Center" nav={nav} roles={['SELLER']}>
      {children}
    </PanelLayout>
  );
}
