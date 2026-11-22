import type { PushTokenInput } from '@marketbd/shared';
import { baseApi } from '../base-api.js';

/** Mobile push notifications: the app registers its Expo token after sign-in and removes it on sign-out. */
export const pushApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    registerPushToken: b.mutation<null, PushTokenInput>({
      query: (body) => ({ url: '/notifications/push-token', method: 'POST', body }),
    }),
    removePushToken: b.mutation<null, { token: string }>({
      query: (body) => ({ url: '/notifications/push-token', method: 'DELETE', body }),
    }),
  }),
});

export const { useRegisterPushTokenMutation, useRemovePushTokenMutation } = pushApi;
