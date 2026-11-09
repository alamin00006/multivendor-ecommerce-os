import type {
  ApiResponse,
  AuthResult,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  OtpRequestInput,
  OtpRequestResult,
  OtpVerifyInput,
  PublicSettings,
  RegisterInput,
  UpdatePlatformSettingsInput,
  UpdateProfileInput,
} from '@marketbd/shared';
import { sessionStarted, signedOut, userUpdated } from '../auth-slice.js';
import { baseApi, unwrap } from '../base-api.js';
import { apiConfig, persistTokens } from '../config.js';

/** Starts a session in the store and persists the refresh token for the platform. */
const startSession = async (
  queryFulfilled: Promise<{ data: AuthResult }>,
  dispatch: (action: ReturnType<typeof sessionStarted>) => unknown,
) => {
  try {
    const { data } = await queryFulfilled;
    await persistTokens(data.tokens);
    dispatch(sessionStarted(data));
  } catch {
    // The calling component shows the error from the mutation result.
  }
};

export const authApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    register: b.mutation<AuthResult, RegisterInput>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      transformResponse: unwrap<AuthResult>,
      onQueryStarted: (_, { queryFulfilled, dispatch }) => startSession(queryFulfilled, dispatch),
      invalidatesTags: ['Me', 'Cart', 'Wishlist', 'Orders', 'Addresses', 'Notifications'],
    }),
    login: b.mutation<AuthResult, LoginInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: unwrap<AuthResult>,
      onQueryStarted: (_, { queryFulfilled, dispatch }) => startSession(queryFulfilled, dispatch),
      invalidatesTags: ['Me', 'Cart', 'Wishlist', 'Orders', 'Addresses', 'Notifications'],
    }),
    requestOtp: b.mutation<OtpRequestResult, OtpRequestInput>({
      query: (body) => ({ url: '/auth/otp/request', method: 'POST', body }),
      transformResponse: unwrap<OtpRequestResult>,
    }),
    verifyOtp: b.mutation<AuthResult, OtpVerifyInput>({
      query: (body) => ({ url: '/auth/otp/verify', method: 'POST', body }),
      transformResponse: unwrap<AuthResult>,
      onQueryStarted: (_, { queryFulfilled, dispatch }) => startSession(queryFulfilled, dispatch),
      invalidatesTags: ['Me', 'Cart', 'Wishlist', 'Orders', 'Addresses', 'Notifications'],
    }),
    logout: b.mutation<null, void>({
      queryFn: async (_arg, api, _extra, baseQuery) => {
        const stored = (await apiConfig().loadRefreshToken?.()) ?? null;
        await baseQuery({ url: '/auth/logout', method: 'POST', body: stored ? { refreshToken: stored } : {} });
        await persistTokens(null);
        api.dispatch(signedOut());
        api.dispatch(baseApi.util.resetApiState());
        return { data: null };
      },
    }),
    me: b.query<AuthUser, void>({
      query: () => '/users/me',
      transformResponse: unwrap<AuthUser>,
      providesTags: ['Me'],
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(userUpdated(data));
        } catch {
          // ignore — handled by session refresh
        }
      },
    }),
    updateProfile: b.mutation<AuthUser, UpdateProfileInput>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      transformResponse: unwrap<AuthUser>,
      invalidatesTags: ['Me'],
    }),
    changePassword: b.mutation<null, ChangePasswordInput>({
      query: (body) => ({ url: '/users/me/password', method: 'POST', body }),
      transformResponse: unwrap<null>,
    }),
    publicSettings: b.query<PublicSettings, void>({
      query: () => '/settings/public',
      transformResponse: (r: ApiResponse<PublicSettings>) => r.data,
      providesTags: ['Settings'],
    }),
    updateSettings: b.mutation<PublicSettings, UpdatePlatformSettingsInput>({
      query: (body) => ({ url: '/admin/settings', method: 'PATCH', body }),
      transformResponse: unwrap<PublicSettings>,
      // Mode changes what every list returns, so drop all cached data.
      invalidatesTags: ['Settings', 'Products', 'Product', 'Cart', 'Categories', 'FlashSale', 'Wishlist', 'Campaigns', 'AdminSellers'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useRequestOtpMutation,
  useVerifyOtpMutation,
  useLogoutMutation,
  useMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  usePublicSettingsQuery,
  useUpdateSettingsMutation,
} = authApi;
