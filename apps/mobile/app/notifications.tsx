import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '@marketbd/api-client';
import { router, Stack } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { colors, Empty, Loading } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function NotificationsScreen() {
  const { t } = useI18n();
  const ready = useRequireAuth('/notifications');
  const { data, isLoading, isFetching, refetch } = useNotificationsQuery({ limit: 50 }, { skip: !ready });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();
  if (!ready || isLoading) return <Loading />;
  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: t.common.notifications,
          headerRight: () => (
            <Pressable onPress={() => void markAll()}>
              <Text className="text-xs font-semibold text-white">{t.account.markAllRead}</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={<Empty icon={<Bell size={48} color={colors.muted} />} title={t.account.noNotifications} />}
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => {
              if (!n.readAt) void markRead(n.id);
              if (n.data?.orderId) router.push(`/orders/${n.data.orderId}`);
            }}
            className="flex-row gap-3 border-b border-ink-100 bg-white px-4 py-3"
          >
            <View className={`mt-1.5 size-2 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-accent-500'}`} />
            <View className="flex-1">
              <Text className={`text-sm ${n.readAt ? '' : 'font-semibold'}`}>{n.title}</Text>
              <Text className="text-sm text-ink-600">{n.body}</Text>
              <Text className="text-[11px] text-ink-400">{new Date(n.createdAt).toLocaleString()}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
