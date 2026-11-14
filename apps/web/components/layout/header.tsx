'use client';

import {
  selectAuth,
  useCartCount,
  useCategoriesQuery,
  useLogoutMutation,
  useMarketplaceMode,
  useUnreadCountQuery,
} from '@marketbd/api-client';
import { BANGLA_ENABLED, BRAND, type CategoryNode } from '@marketbd/shared';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  LayoutGrid,
  Package,
  ShoppingCart,
  Smartphone,
  Store,
  User,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useI18n } from '@marketbd/ui';
import { Logo } from '@marketbd/ui';
import { SearchBar } from './search-bar';

function CategoryMenu({ categories }: { categories: CategoryNode[] }) {
  const { t, pick } = useI18n();
  const [active, setActive] = useState(0);
  const current = categories[active];
  return (
    <div className="absolute left-0 top-full z-40 hidden pt-1 group-hover:block">
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
                <Link
                  key={sub.id}
                  href={`/c/${sub.slug}`}
                  className="group/sub flex flex-col items-center gap-2 text-center"
                >
                  {sub.imageUrl && (
                    <Image
                      src={sub.imageUrl}
                      alt=""
                      width={96}
                      height={96}
                      className="size-20 rounded-lg object-cover transition group-hover/sub:scale-105"
                    />
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
      <Link href="/login" className="flex flex-col leading-tight">
        <span className="text-[11px] text-ink-500">{t.common.signIn}</span>
        <span className="flex items-center gap-0.5 text-sm font-semibold text-ink-800">
          {t.common.account} <ChevronDown className="size-3.5" />
        </span>
      </Link>
    );
  }
  return (
    <div className="group relative">
      <button type="button" className="flex flex-col items-start leading-tight">
        <span className="max-w-32 truncate text-[11px] text-ink-500">{user.name}</span>
        <span className="flex items-center gap-0.5 text-sm font-semibold text-ink-800">
          {t.common.account} <ChevronDown className="size-3.5" />
        </span>
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
            <a
              href={process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3101'}
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50"
            >
              <LayoutGrid className="size-4" /> {t.common.adminPanel}
            </a>
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

/** Second header row: "All categories" mega menu + scrollable top-level category links. */
function CategoryNav({ categories }: { categories: CategoryNode[] }) {
  const { t, pick, setLocale, locale } = useI18n();
  const { sellerFeatures } = useMarketplaceMode();
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  return (
    <div className="hidden border-t border-ink-100 md:block">
      <div className="container-header flex h-10 items-center gap-4 text-[13px]">
        <div className="group relative shrink-0">
          <Link
            href="/categories"
            className="flex h-10 items-center gap-1.5 font-semibold text-ink-800 hover:text-primary-700"
          >
            <LayoutGrid className="size-4" /> {t.common.allCategories}
          </Link>
          {categories.length > 0 && <CategoryMenu categories={categories} />}
        </div>
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="shrink-0 text-ink-400 hover:text-ink-800"
          aria-label="Scroll categories left"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div ref={row} className="scrollbar-none flex min-w-0 flex-1 items-center gap-5 overflow-x-auto scroll-smooth">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-ink-600 hover:text-primary-700"
            >
              {c.iconUrl && <Image src={c.iconUrl} alt="" width={16} height={16} className="size-4 rounded-sm" />}
              {pick(c.name, c.nameBn)}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => scroll(1)}
          className="shrink-0 text-ink-400 hover:text-ink-800"
          aria-label="Scroll categories right"
        >
          <ChevronRight className="size-4" />
        </button>
        {sellerFeatures && (
          <Link href="/sell" className="shrink-0 font-semibold text-primary-700 hover:underline">
            {t.common.sellOn}
          </Link>
        )}
        {BANGLA_ENABLED && (
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
            className="shrink-0 rounded border border-ink-200 px-2 py-0.5 text-xs font-semibold"
          >
            {t.common.language}
          </button>
        )}
      </div>
    </div>
  );
}

export function Header() {
  const { t, setLocale, locale } = useI18n();
  const { data: categories = [] } = useCategoriesQuery();
  const cartCount = useCartCount();
  const authed = useSelector(selectAuth).status === 'authenticated';
  const { data: unread } = useUnreadCountQuery(undefined, { skip: !authed, pollingInterval: 60_000 });

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="container-header flex h-16 items-center gap-4 md:gap-6">
        <Logo />
        <Link href="/help" className="hidden items-center gap-2 lg:flex">
          <Smartphone className="size-6 text-primary-700" />
          <span className="text-[11px] leading-tight text-ink-600">
            {t.footer.appOffer}
            <br />
            <b className="text-ink-800">{BRAND.name} App</b>
          </span>
        </Link>
        <Suspense fallback={<div className="h-10 flex-1" />}>
          <SearchBar className="hidden flex-1 md:block" />
        </Suspense>
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden md:block">
            <AccountMenu />
          </div>
          {authed && (
            <Link
              href="/account/notifications"
              className="relative hidden text-ink-700 md:block"
              aria-label={t.common.notifications}
            >
              <Bell className="size-6" />
              {unread && unread.count > 0 ? (
                <span className="absolute -right-2 -top-1.5 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                  {unread.count > 99 ? '99+' : unread.count}
                </span>
              ) : null}
            </Link>
          )}
          {BANGLA_ENABLED && (
            <button
              type="button"
              onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
              className="rounded border border-ink-200 px-2 py-1 text-xs font-semibold md:hidden"
            >
              {locale === 'en' ? 'বাং' : 'EN'}
            </button>
          )}
          <Link href="/cart" className="relative flex items-center gap-1.5 text-ink-700" aria-label={t.common.cart}>
            <span className="relative">
              <ShoppingCart className="size-6" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-1.5 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span className="hidden text-sm md:inline">{t.common.cart}</span>
          </Link>
        </div>
      </div>

      <CategoryNav categories={categories} />

      <div className="container-header pb-2 md:hidden">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}
