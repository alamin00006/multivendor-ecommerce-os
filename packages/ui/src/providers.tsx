'use client';

import {
  type AppDispatch,
  type AppStore,
  configureApiClient,
  guestCartHydrated,
  type GuestCartItem,
  makeStore,
  restoreSession,
  useGuestCartMerge,
} from '@marketbd/api-client';
import { LOCALE_COOKIE, type UiLocale } from '@marketbd/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { Toaster } from 'sonner';
import { I18nProvider } from './i18n';

const GUEST_CART_KEY = 'mbd_guest_cart';

const readLocale = (): UiLocale =>
  typeof document !== 'undefined' && document.cookie.includes(`${LOCALE_COOKIE}=bn`) ? 'bn' : 'en';

// Each Next app proxies /api/v1 to the API (next.config rewrites), so the httpOnly
// refresh-token cookie is same-origin.
configureApiClient({
  baseUrl: '/api/v1',
  credentials: 'include',
  getLocale: readLocale,
});

function SessionBootstrap({ guestCart }: { guestCart: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);
  return guestCart ? <GuestCartMerge /> : null;
}

function GuestCartMerge() {
  useGuestCartMerge();
  return null;
}

/** Keeps the guest cart in localStorage so it survives reloads until sign-in merges it. */
function usePersistedGuestCart(store: AppStore, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(GUEST_CART_KEY);
      if (raw) store.dispatch(guestCartHydrated(JSON.parse(raw) as GuestCartItem[]));
    } catch {
      localStorage.removeItem(GUEST_CART_KEY);
    }
    let last = store.getState().guestCart.items;
    return store.subscribe(() => {
      const items = store.getState().guestCart.items;
      if (items !== last) {
        last = items;
        try {
          localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
        } catch {
          // storage full or blocked — the cart still works for this tab
        }
      }
    });
  }, [store, enabled]);
}

/**
 * Redux store, i18n and toasts for a Next.js app.
 * The storefront enables the guest cart; the admin app does not need it.
 */
export function AppProviders({
  locale,
  guestCart = false,
  children,
}: {
  locale: UiLocale;
  guestCart?: boolean;
  children: ReactNode;
}) {
  const [store] = useState<AppStore>(() => makeStore());
  usePersistedGuestCart(store, guestCart);
  return (
    <I18nProvider locale={locale}>
      <Provider store={store}>
        <SessionBootstrap guestCart={guestCart} />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </Provider>
    </I18nProvider>
  );
}
