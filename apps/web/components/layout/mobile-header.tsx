'use client';

import { useMarketplaceMode } from '@marketbd/api-client';
import { BRAND, type CategoryNode } from '@marketbd/shared';
import { ChevronRight, CircleHelp, LayoutGrid, Menu, ShoppingBag, Store, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo, useHydrated, useI18n } from '@marketbd/ui';

const DISMISS_KEY = 'mbd_app_banner_dismissed';

/** Phones, home page only: "Get the app" strip above the header (dismissed for good with ×). */
export function AppBanner() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  // Read once on the client; nothing renders before hydration, so the server output always matches.
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!hydrated || hidden || pathname !== '/') return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: hide for this visit only */
    }
  };
  return (
    <div className="relative bg-primary-50 px-4 pb-3 pt-3 md:hidden">
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded p-1 text-ink-500" aria-label="Close app banner">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-700 text-white">
          <ShoppingBag className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary-800">{BRAND.name}: Online Shopping</p>
          <p className="text-[13px] leading-snug text-ink-800">Exclusive app-only deals, faster checkout and order updates on your phone.</p>
        </div>
      </div>
      <Link href="/help/about" className="mt-2.5 block rounded-lg bg-primary-700 py-2.5 text-center text-sm font-semibold text-white">
        Get the app
      </Link>
    </div>
  );
}

/** Phones only: ☰ button that opens a side drawer with the logo, categories and help links. */
export function MobileMenu({ categories }: { categories: CategoryNode[] }) {
  const { t, pick } = useI18n();
  const { sellerFeatures } = useMarketplaceMode();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Close the drawer after navigating.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded p-1 text-ink-700 md:hidden" aria-label="Open menu" aria-expanded={open}>
        <Menu className="size-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setOpen(false)}>
          <nav
            aria-label="Menu"
            className="flex h-full w-[82%] max-w-xs flex-col overflow-y-auto bg-white shadow-raised"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-ink-500" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <Link href="/categories" className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-900">
              <LayoutGrid className="size-4 text-primary-700" /> {t.common.allCategories}
            </Link>
            <ul className="border-b border-ink-100 pb-2">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.slug}`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50">
                    {c.iconUrl ? <Image src={c.iconUrl} alt="" width={20} height={20} className="size-5 rounded-sm" /> : <span className="size-5" />}
                    <span className="flex-1">{pick(c.name, c.nameBn)}</span>
                    <ChevronRight className="size-4 text-ink-300" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/help" className="flex items-center gap-2 px-4 py-3 text-sm text-ink-700">
              <CircleHelp className="size-4 text-primary-700" /> {t.common.helpCenter}
            </Link>
            {sellerFeatures && (
              <Link href="/sell" className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-primary-700">
                <Store className="size-4" /> {t.common.sellOn}
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
