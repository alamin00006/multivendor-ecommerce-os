import {
  errorMessage,
  sendChatTyping,
  useChatLive,
  useChatThreadQuery,
  useChatTyping,
  useMarkConversationReadMutation,
  useProductQuery,
  useSendMessageMutation,
} from '@marketbd/api-client';
import type { ChatMessageView } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCheck, MessageCircle, Send, Store, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, Empty, Loading, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';
import { chatTime } from '@/lib/chat';
import { img } from '@/lib/config';
import { useRequireAuth } from '@/lib/use-require-auth';

function ProductChip({ product }: { product: NonNullable<ChatMessageView['product']> }) {
  const { money } = useI18n();
  return (
    <Pressable onPress={() => router.push(`/product/${product.slug}`)} className="mb-1 w-60 flex-row items-center gap-2 rounded-xl border border-ink-100 bg-white p-2">
      <Image source={img(product.imageUrl, 48)} style={{ width: 48, height: 48, borderRadius: 6 }} />
      <View className="flex-1">
        <Text numberOfLines={2} className="text-xs text-ink-800">{product.title}</Text>
        <Text className="text-sm font-bold text-accent-600">{money(product.price)}</Text>
      </View>
    </Pressable>
  );
}

export default function ChatScreen() {
  const { id, product: productSlug } = useLocalSearchParams<{ id: string; product?: string }>();
  const { money } = useI18n();
  const insets = useSafeAreaInsets();
  const ready = useRequireAuth(`/chat/${id}`);
  const [limit, setLimit] = useState(50);
  const live = useChatLive();
  const typing = useChatTyping(id);
  // Socket.IO pushes updates; polling is only the fallback while it is disconnected.
  const { data, isLoading, isError } = useChatThreadQuery({ id, limit }, { skip: !ready, pollingInterval: live ? 0 : 4_000 });
  const { currentData: attach } = useProductQuery(productSlug ?? '', { skip: !productSlug });
  const [attachDismissed, setAttachDismissed] = useState(false);
  const [send, sendState] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [draft, setDraft] = useState('');
  const lastSeenIncoming = useRef<string | null>(null);

  const conversation = data?.conversation;
  // Inverted list: newest first so the view opens at the bottom.
  const messages = useMemo(() => [...(data?.messages ?? [])].reverse(), [data]);

  useEffect(() => {
    if (!conversation) return;
    const lastIncoming = messages.find((m) => m.side !== conversation.viewerSide)?.id ?? null;
    if (conversation.unread > 0 || (lastIncoming && lastSeenIncoming.current !== null && lastIncoming !== lastSeenIncoming.current)) {
      void markRead(id);
    }
    lastSeenIncoming.current = lastIncoming;
  }, [conversation, messages, id, markRead]);

  if (!ready || isLoading) return <Loading />;
  if (isError || !conversation) {
    return (
      <View className="flex-1 bg-canvas">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Chat" />
        <Empty icon={<MessageCircle size={48} color={colors.muted} />} title="This conversation is not available" />
      </View>
    );
  }

  const attachProduct = !attach || attachDismissed || (attach.seller && attach.seller.id !== conversation.shop.id) ? null : attach;
  const readUpTo = conversation.otherLastReadAt ? new Date(conversation.otherLastReadAt).getTime() : 0;
  const lastMineId = messages.find((m) => m.side === conversation.viewerSide)?.id;

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await send({ id, body, productId: attachProduct?.id }).unwrap();
      setDraft('');
      if (attachProduct) setAttachDismissed(true);
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        right={
          !conversation.shop.isHouseStore ? (
            <Pressable onPress={() => router.push(`/shop/${conversation.shop.slug}`)} className="flex-row items-center gap-1 rounded-lg bg-white/80 px-2.5 py-2">
              <Store size={16} color={colors.primaryDark} />
              <Text className="text-sm font-semibold text-primary-800">Store</Text>
            </Pressable>
          ) : undefined
        }
      >
        <View className="flex-1 flex-row items-center gap-2.5">
          {conversation.shop.logoUrl ? (
            <Image source={img(conversation.shop.logoUrl, 36)} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <View className="size-9 items-center justify-center rounded-full bg-primary-100">
              <Text className="font-bold text-primary-800">{conversation.shop.name.charAt(0)}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text numberOfLines={1} className="text-lg font-bold text-ink-900">{conversation.shop.name}</Text>
            {typing ? <Text className="text-xs font-medium text-primary-600">typing…</Text> : null}
          </View>
        </View>
      </ScreenHeader>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onEndReached={() => {
            if (data?.hasMore) setLimit((n) => Math.min(n + 50, 200));
          }}
          ListEmptyComponent={
            <View className="items-center py-10">
              <Text className="text-center text-sm text-ink-500">Ask {conversation.shop.name} anything about their products.</Text>
            </View>
          }
          renderItem={({ item: m }) => {
            const mine = m.side === conversation.viewerSide;
            return (
              <View className={mine ? 'items-end' : 'items-start'}>
                {m.product ? <ProductChip product={m.product} /> : null}
                <View className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'rounded-br-md bg-primary-700' : 'rounded-bl-md bg-white'}`}>
                  <Text className={`text-base ${mine ? 'text-white' : 'text-ink-800'}`}>{m.body}</Text>
                </View>
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Text className="text-[11px] text-ink-400">{chatTime(m.createdAt)}</Text>
                  {mine && m.id === lastMineId && new Date(m.createdAt).getTime() <= readUpTo ? (
                    <>
                      <CheckCheck size={12} color={colors.primary} />
                      <Text className="text-[11px] text-ink-400">Seen</Text>
                    </>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View className="border-t border-ink-100 bg-white px-3 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
          {attachProduct ? (
            <View className="mb-2 flex-row items-center gap-2 rounded-xl bg-primary-50 p-2">
              <Image source={img(attachProduct.images[0]?.url, 40)} style={{ width: 40, height: 40, borderRadius: 6 }} />
              <View className="flex-1">
                <Text className="text-xs text-ink-500">Asking about</Text>
                <Text numberOfLines={1} className="text-sm font-medium text-ink-800">{attachProduct.title}</Text>
              </View>
              <Text className="font-bold text-accent-600">{money(attachProduct.price)}</Text>
              <Pressable onPress={() => setAttachDismissed(true)} hitSlop={8} accessibilityLabel="Remove product">
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <View className="flex-row items-end gap-2">
            <TextInput
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                if (value.trim()) sendChatTyping(id);
              }}
              placeholder="Type a message…"
              multiline
              maxLength={2000}
              className="max-h-28 min-h-11 flex-1 rounded-2xl border border-ink-200 px-4 py-2.5 text-base"
            />
            <Pressable
              onPress={() => void submit()}
              disabled={!draft.trim() || sendState.isLoading}
              accessibilityLabel="Send"
              className={`size-11 items-center justify-center rounded-full bg-primary-700 ${!draft.trim() ? 'opacity-40' : ''}`}
            >
              {sendState.isLoading ? <ActivityIndicator color="#fff" /> : <Send size={20} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
