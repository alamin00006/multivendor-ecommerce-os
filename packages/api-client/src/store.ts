import { combineReducers, configureStore, type Middleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authSlice } from './auth-slice.js';
import { baseApi } from './base-api.js';
import { guestCartSlice } from './guest-cart-slice.js';

export const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authSlice.reducer,
  guestCart: guestCartSlice.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** Creates the Redux store used by web and mobile. Platforms add persistence middleware. */
export const makeStore = (options: { preloadedState?: Partial<RootState>; middleware?: Middleware[] } = {}) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: options.preloadedState as RootState | undefined,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware, ...(options.middleware ?? [])),
  });
  setupListeners(store.dispatch);
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
