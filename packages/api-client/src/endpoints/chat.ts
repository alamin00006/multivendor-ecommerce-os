import type {
  ChatMessageView,
  ChatThread,
  ConversationListQuery,
  ConversationView,
  SendMessageInput,
  StartConversationInput,
} from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

/** Which inbox to read: the customer's own threads, a seller's shop, or the house store (admins). */
export type ChatScope = 'customer' | 'seller' | 'admin';

const inboxPath = (scope: ChatScope) => (scope === 'customer' ? '/chat' : `/${scope}/chat`);

/**
 * Customer ↔ shop messaging. Screens poll these queries (RTK Query `pollingInterval`)
 * so new messages and unread badges appear without a page reload.
 */
export const chatApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    conversations: b.query<Page<ConversationView>, { scope: ChatScope } & ConversationListQuery>({
      query: ({ scope, ...params }) => `${inboxPath(scope)}/conversations${qs(params)}`,
      transformResponse: unwrapPage<ConversationView>,
      providesTags: ['Chat'],
    }),
    chatUnread: b.query<{ count: number }, ChatScope>({
      query: (scope) => `${inboxPath(scope)}/unread`,
      transformResponse: unwrap<{ count: number }>,
      providesTags: ['Chat'],
    }),
    chatThread: b.query<ChatThread, { id: string; limit?: number }>({
      query: ({ id, limit }) => `/chat/conversations/${id}/messages${qs({ limit })}`,
      transformResponse: unwrap<ChatThread>,
      providesTags: (_r, _e, { id }) => [{ type: 'Chat', id }],
    }),
    startConversation: b.mutation<ConversationView, StartConversationInput>({
      query: (body) => ({ url: '/chat/conversations', method: 'POST', body }),
      transformResponse: unwrap<ConversationView>,
      invalidatesTags: ['Chat'],
    }),
    sendMessage: b.mutation<ChatMessageView, { id: string } & SendMessageInput>({
      query: ({ id, ...body }) => ({ url: `/chat/conversations/${id}/messages`, method: 'POST', body }),
      transformResponse: unwrap<ChatMessageView>,
      invalidatesTags: ['Chat'],
    }),
    markConversationRead: b.mutation<void, string>({
      query: (id) => ({ url: `/chat/conversations/${id}/read`, method: 'POST' }),
      // Refreshes unread badges and inbox rows. Screens call it only when a new incoming message arrives.
      invalidatesTags: ['Chat'],
    }),
  }),
});

export const {
  useConversationsQuery,
  useChatUnreadQuery,
  useChatThreadQuery,
  useStartConversationMutation,
  useSendMessageMutation,
  useMarkConversationReadMutation,
} = chatApi;
