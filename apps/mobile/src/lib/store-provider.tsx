import AsyncStorage from '@react-native-async-storage/async-storage';
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
import * as SecureStore from 'expo-secure-store';
import { type ReactNode, useEffect, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { getCurrentLocale } from '@/i18n';
import { API_URL } from './config';

const REFRESH_KEY = 'mbd_refresh_token';
const GUEST_CART_KEY = 'mbd_guest_cart';

// Mobile keeps the refresh token in the OS keychain/keystore (expo-secure-store).
configureApiClient({
  baseUrl: API_URL,
  credentials: 'omit',
  loadRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  saveRefreshToken: async (token) => {
    if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
  getLocale: getCurrentLocale,
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
    let last = store.getState().guestCart.items;
    void AsyncStorage.getItem(GUEST_CART_KEY).then((raw) => {
      if (!raw) return;
      try {
        store.dispatch(guestCartHydrated(JSON.parse(raw) as GuestCartItem[]));
        last = store.getState().guestCart.items;
      } catch {
        void AsyncStorage.removeItem(GUEST_CART_KEY);
      }
    });
    return store.subscribe(() => {
      const items = store.getState().guestCart.items;
      if (items !== last) {
        last = items;
        void AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
      }
    });
  }, [store]);

  return (
    <Provider store={store}>
      <SessionBootstrap />
      {children}
    </Provider>
  );
}
