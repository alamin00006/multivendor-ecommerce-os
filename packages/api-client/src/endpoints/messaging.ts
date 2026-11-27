import type { MessagingSettingsInput, MessagingSettingsView } from '@marketbd/shared';
import { baseApi, unwrap } from '../base-api.js';

/** Admin → Settings → Customer messages (order emails & SMS). */
export const messagingApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    messagingSettings: b.query<MessagingSettingsView, void>({
      query: () => '/admin/settings/messaging',
      transformResponse: unwrap<MessagingSettingsView>,
      providesTags: ['Messaging'],
    }),
    saveMessagingSettings: b.mutation<MessagingSettingsView, MessagingSettingsInput>({
      query: (body) => ({ url: '/admin/settings/messaging', method: 'PUT', body }),
      transformResponse: unwrap<MessagingSettingsView>,
      invalidatesTags: ['Messaging'],
    }),
    sendTestMessage: b.mutation<{ delivered: boolean }, { channel: 'email' | 'sms'; to: string }>({
      query: (body) => ({ url: '/admin/settings/messaging/test', method: 'POST', body }),
      transformResponse: unwrap<{ delivered: boolean }>,
    }),
  }),
});

export const { useMessagingSettingsQuery, useSaveMessagingSettingsMutation, useSendTestMessageMutation } = messagingApi;
