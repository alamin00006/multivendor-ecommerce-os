import { useChatLive, useConversationsQuery, useIsAuthenticated } from '@marketbd/api-client';
import type { ConversationView } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Button, colors, Empty, Loading, ScreenHeader } from '@/components/ui';
import { useI18n } from '@/i18n';
import { chatTime } from '@/lib/chat';
import { img } from '@/lib/config';

function Row({ c }: { c: ConversationView }) {
  const mine = c.lastMessage?.side === c.viewerSide;
  return (
    <Pressable onPress={() => router.push(`/chat/${c.id}`)} className="flex-row items-center gap-3 bg-white px-4 py-3.5">
      {c.shop.logoUrl ? (
        <Image source={img(c.shop.logoUrl, 52)} style={{ width: 52, height: 52, borderRadius: 26 }} />
      ) : (
        <View className="size-[52px] items-center justify-center rounded-full bg-primary-100">
          <Text className="text-xl font-bold text-primary-800">{c.shop.name.charAt(0)}</Text>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text numberOfLines={1} className={`flex-1 text-base ${c.unread ? 'font-bold text-ink-900' : 'font-medium text-ink-800'}`}>
            {c.shop.name}
          </Text>
          {c.lastMessage ? <Text className="text-xs text-ink-400">{chatTime(c.lastMessage.createdAt)}</Text> : null}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text numberOfLines={1} className={`flex-1 text-sm ${c.unread ? 'font-semibold text-ink-800' : 'text-ink-500'}`}>
            {c.lastMessage ? `${mine ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages yet'}
          </Text>
          {c.unread > 0 ? (
            <View className="min-w-5 items-center rounded-full bg-accent-500 px-1.5">
              <Text className="text-xs font-bold text-white">{c.unread > 99 ? '99+' : c.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { t } = useI18n();
  const authed = useIsAuthenticated();
  const live = useChatLive();
  const { data, isLoading, isFetching, refetch } = useConversationsQuery(
    { scope: 'customer', page: 1, limit: 50 },
    { skip: !authed, pollingInterval: live ? 0 : 15_000 },
  );

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader back={false} title="Messages" />
      {!authed ? (
        <Empty
          icon={<MessageCircle size={56} color={colors.muted} />}
          title="Chat with sellers"
          text="Sign in to message shops about products and orders."
          action={<Button title={t.common.signIn} onPress={() => router.push({ pathname: '/login', params: { next: '/messages' } })} />}
        />
      ) : isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <Row c={item} />}
          ItemSeparatorComponent={() => <View className="ml-[80px] h-px bg-ink-100" />}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={
            <Empty
              icon={<MessageCircle size={56} color={colors.muted} />}
              title="No conversations yet"
              text="Tap “Chat” on a product page to message the seller."
            />
          }
        />
      )}
    </View>
  );
}
