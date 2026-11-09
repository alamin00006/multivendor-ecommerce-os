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
import { type ReactNode, useEffect, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { Toaster } from 'sonner';
import { LOCALE_COOKIE } from '@/i18n';

const GUEST_CART_KEY = 'mbd_guest_cart';

const readLocale = (): 'en' | 'bn' =>
  typeof document !== 'undefined' && document.cookie.includes(`${LOCALE_COOKIE}=bn`) ? 'bn' : 'en';

// Same-origin API (see next.config rewrites) — the refresh token is an httpOnly cookie.
configureApiClient({
  baseUrl: '/api/v1',
  credentials: 'include',
  getLocale: readLocale,
});

function SessionBootstrap() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);
  useGuestCartMerge();
  return null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());

  useEffect(() => {
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
  }, [store]);

  return (
    <Provider store={store}>
      <SessionBootstrap />
      {children}
      <Toaster position="top-center" richColors closeButton />
    </Provider>
  );
}
