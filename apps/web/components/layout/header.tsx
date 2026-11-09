'use client';

import {
  selectAuth,
  useCartCount,
  useCategoriesQuery,
  useLogoutMutation,
  useMarketplaceMode,
  useUnreadCountQuery,
} from '@marketbd/api-client';
import type { CategoryNode } from '@marketbd/shared';
import { Bell, ChevronDown, Heart, LayoutGrid, Package, ShoppingCart, Store, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSelector } from 'react-redux';
import { useI18n } from '@/i18n/client';
import { Logo } from './logo';
import { SearchBar } from './search-bar';

function CategoryMenu({ categories }: { categories: CategoryNode[] }) {
  const { t, pick } = useI18n();
  const [active, setActive] = useState(0);
  const current = categories[active];
  return (
    <div className="absolute left-0 top-full z-40 hidden pt-2 group-hover:block">
      <div className="flex w-[720px] overflow-hidden rounded-lg border border-ink-100 bg-white shadow-raised">
        <ul className="w-60 border-r border-ink-100 py-2">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.slug}`}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-2 px-4 py-2 text-sm ${i === active ? 'bg-primary-50 text-primary-800' : 'text-ink-700'}`}
              >
                {c.iconUrl && <Image src={c.iconUrl} alt="" width={20} height={20} className="size-5 rounded" />}
                {pick(c.name, c.nameBn)}
              </Link>
            </li>
          ))}
        </ul>
        {current && (
          <div className="flex-1 p-5">
            <Link href={`/c/${current.slug}`} className="mb-4 block font-semibold text-primary-800 hover:underline">
              {pick(current.name, current.nameBn)} · {t.common.seeAll}
            </Link>
            <div className="grid grid-cols-3 gap-4">
              {current.children.map((sub) => (
                <Link key={sub.id} href={`/c/${sub.slug}`} className="group/sub flex flex-col items-center gap-2 text-center">
                  {sub.imageUrl && (
                    <Image src={sub.imageUrl} alt="" width={96} height={96} className="size-20 rounded-lg object-cover transition group-hover/sub:scale-105" />
                  )}
                  <span className="text-xs text-ink-700">{pick(sub.name, sub.nameBn)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const { user, status } = useSelector(selectAuth);
  const { sellerFeatures } = useMarketplaceMode();
  const [logout] = useLogoutMutation();

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex items-center gap-1 text-sm">
        <User className="size-5 text-ink-600" />
        <Link href="/login" className="font-semibold hover:text-primary-700">
          {t.common.signIn}
        </Link>
        <span className="text-ink-300">/</span>
        <Link href="/register" className="hover:text-primary-700">
          {t.common.signUp}
        </Link>
      </div>
    );
  }
  return (
    <div className="group relative">
      <button type="button" className="flex items-center gap-1.5 text-sm font-medium">
        <User className="size-5 text-ink-600" />
        <span className="max-w-28 truncate">{user.name.split(' ')[0]}</span>
        <ChevronDown className="size-4" />
      </button>
      <div className="absolute right-0 top-full z-40 hidden pt-2 group-hover:block">
        <div className="w-56 overflow-hidden rounded-lg border border-ink-100 bg-white py-1 shadow-raised">
          <Link href="/account" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50">
            <User className="size-4" /> {t.common.account}
          </Link>
          <Link href="/account/orders" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50">
            <Package className="size-4" /> {t.common.orders}
          </Link>
          <Link href="/account/wishlist" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50">
            <Heart className="size-4" /> {t.common.wishlist}
          </Link>
          {user.role === 'SELLER' && sellerFeatures && (
            <Link href="/seller" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50">
              <Store className="size-4" /> {t.common.sellerCenter}
            </Link>
          )}
          {user.role === 'ADMIN' && (
            <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50">
              <LayoutGrid className="size-4" /> {t.common.adminPanel}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full border-t border-ink-100 px-4 py-2 text-left text-sm text-danger hover:bg-ink-50"
          >
            {t.common.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { t, setLocale, locale } = useI18n();
  const { sellerFeatures } = useMarketplaceMode();
  const { data: categories = [] } = useCategoriesQuery();
  const cartCount = useCartCount();
  const authed = useSelector(selectAuth).status === 'authenticated';
  const { data: unread } = useUnreadCountQuery(undefined, { skip: !authed, pollingInterval: 60_000 });

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      {/* Utility strip */}
      <div className="hidden bg-primary-800 text-xs text-primary-50 md:block">
        <div className="container-site flex h-8 items-center justify-end gap-5">
          {sellerFeatures && (
            <Link href="/sell" className="hover:text-white">
              {t.common.sellOn}
            </Link>
          )}
          <Link href="/help" className="hover:text-white">
            {t.common.helpCenter}
          </Link>
          <button type="button" onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')} className="font-semibold hover:text-white">
            {t.common.language}
          </button>
        </div>
      </div>

      {/* Main row */}
      <div className="container-site flex h-16 items-center gap-4 md:gap-8">
        <Logo />
        <div className="group relative hidden lg:block">
          <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-ink-700 hover:text-primary-700">
            <LayoutGrid className="size-5" />
            {t.common.categories}
            <ChevronDown className="size-4" />
          </button>
          {categories.length > 0 && <CategoryMenu categories={categories} />}
        </div>
        <Suspense fallback={<div className="h-10 flex-1" />}>
          <SearchBar className="hidden flex-1 md:block" />
        </Suspense>
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden md:block">
            <AccountMenu />
          </div>
          {authed && (
            <Link href="/account/notifications" className="relative hidden text-ink-700 md:block" aria-label={t.common.notifications}>
              <Bell className="size-6" />
              {unread && unread.count > 0 ? (
                <span className="absolute -right-2 -top-1.5 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                  {unread.count > 99 ? '99+' : unread.count}
                </span>
              ) : null}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
            className="rounded border border-ink-200 px-2 py-1 text-xs font-semibold md:hidden"
          >
            {locale === 'en' ? 'বাং' : 'EN'}
          </button>
          <Link href="/cart" className="relative text-ink-700" aria-label={t.common.cart}>
            <ShoppingCart className="size-6" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-1.5 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile search row */}
      <div className="container-site pb-2 md:hidden">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}
