import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  type BaseQueryApi,
  type BaseQueryFn,
  createApi,
  type FetchArgs,
  fetchBaseQuery,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { ApiErrorBody, ApiResponse, AuthResult, PaginationMeta } from '@marketbd/shared';
import { restoring, type RootStateWithAuth, sessionStarted, signedOut } from './auth-slice.js';
import { apiConfig, persistTokens } from './config.js';

export const TAG_TYPES = [
  'Me',
  'Settings',
  'Categories',
  'Brands',
  'Products',
  'Product',
  'Cart',
  'Wishlist',
  'Addresses',
  'Orders',
  'Reviews',
  'Campaigns',
  'FlashSale',
  'Banners',
  'QuickLinks',
  'Notifications',
  'Coupons',
  'SellerProfile',
  'SellerProducts',
  'SellerOrders',
  'SellerDashboard',
  'AdminDashboard',
  'AdminUsers',
  'AdminSellers',
  'AdminProducts',
  'AdminOrders',
  'AdminReturns',
  'AdminReviews',
  'AdminCampaigns',
  'AdminFlashSales',
  'AdminBanners',
  'AdminQuickLinks',
  'AdminCoupons',
  'AdminCategories',
  'AdminBrands',
] as const;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootStateWithAuth).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const locale = apiConfig().getLocale?.();
    if (locale) headers.set('Accept-Language', locale);
    return headers;
  },
});

const withBase = (args: string | FetchArgs): FetchArgs => {
  const { baseUrl, credentials } = apiConfig();
  const a = typeof args === 'string' ? { url: args } : args;
  return { ...a, url: `${baseUrl}${a.url}`, credentials };
};

let refreshing: Promise<boolean> | null = null;

/** Exchanges the refresh token (cookie on web, SecureStore on mobile) for a new session. */
export const refreshSession = async (
  api: BaseQueryApi,
  extraOptions: object = {},
): Promise<boolean> => {
  refreshing ??= (async () => {
    const stored = (await apiConfig().loadRefreshToken?.()) ?? null;
    const result = await rawBaseQuery(
      withBase({ url: '/auth/refresh', method: 'POST', body: stored ? { refreshToken: stored } : {} }),
      api,
      extraOptions,
    );
    const body = result.data as ApiResponse<AuthResult> | undefined;
    if (body?.success) {
      await persistTokens(body.data.tokens);
      api.dispatch(sessionStarted(body.data));
      return true;
    }
    await persistTokens(null);
    api.dispatch(signedOut());
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

/** Base query: prefixes the API URL and transparently refreshes the access token once on 401. */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  if (refreshing) await refreshing;
  let result = await rawBaseQuery(withBase(args), api, extraOptions);
  const url = typeof args === 'string' ? args : args.url;
  const hadSession = Boolean((api.getState() as RootStateWithAuth).auth.accessToken);

  if (result.error?.status === 401 && hadSession && !url.startsWith('/auth/')) {
    if (await refreshSession(api, extraOptions)) {
      result = await rawBaseQuery(withBase(args), api, extraOptions);
    } else {
      apiConfig().onSessionExpired?.();
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: TAG_TYPES,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

// ───── Response helpers ─────

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

export const unwrap = <T>(res: ApiResponse<T>): T => res.data;
export const unwrapPage = <T>(res: ApiResponse<T[]>): Page<T> => ({
  items: res.data,
  meta: res.meta ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 },
});

/** Converts params into a query string, skipping empty values. */
export const qs = (params: object | undefined): string => {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','));
    } else search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

/** Human-readable message from any RTK Query error. */
export const errorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as { status?: unknown; data?: unknown; error?: string };
  const data = e.data as Partial<ApiErrorBody> | undefined;
  if (data && typeof data.message === 'string') {
    const first = data.errors?.[0];
    return first && data.message === 'Validation failed' ? first.message : data.message;
  }
  if (e.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection.';
  return e.error ?? fallback;
};

/** Field errors from a validation failure, keyed by path. */
export const fieldErrors = (error: unknown): Record<string, string> => {
  const data = (error as { data?: Partial<ApiErrorBody> } | undefined)?.data;
  return Object.fromEntries((data?.errors ?? []).map((e) => [e.path, e.message]));
};

/** Restores a session on app start from the stored refresh token / cookie. Resolves to true when signed in. */
export const restoreSession = createAsyncThunk('auth/restoreSession', async (_: void, thunk) => {
  thunk.dispatch(restoring());
  const api: BaseQueryApi = {
    dispatch: thunk.dispatch,
    getState: thunk.getState,
    signal: thunk.signal,
    abort: () => undefined,
    extra: undefined,
    endpoint: 'restoreSession',
    type: 'mutation',
  };
  return refreshSession(api);
});
