import { errorMessage, useCreateReviewMutation, useMyReviewsQuery, usePendingReviewsQuery } from '@marketbd/api-client';
import type { ReviewableItem } from '@marketbd/shared';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { fmtDate, Sheet, UnderlineTabs } from '@/components/account';
import { PhotoPicker } from '@/components/photo-picker';
import { Button, colors, Loading, Stars } from '@/components/ui';
import { img } from '@/lib/config';
import { useRequireAuth } from '@/lib/use-require-auth';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Small centred "5.0" card shown when there is nothing to review (cartup style). */
function EmptyReviews({ title }: { title: string }) {
  return (
    <View className="m-4 items-center gap-2 rounded-xl bg-white px-6 py-10">
      <View className="size-20 items-center justify-center rounded-full border-4 border-amber-300">
        <Text className="text-2xl font-bold text-ink-900">5.0</Text>
      </View>
      <Stars value={5} size={16} />
      <Text className="mt-1 text-center text-base font-semibold text-ink-900">{title}</Text>
      <Pressable onPress={() => router.push('/')} className="mt-2 rounded-lg bg-primary-700 px-6 py-2.5">
        <Text className="font-semibold text-white">Start Shopping</Text>
      </Pressable>
    </View>
  );
}

function WriteSheet({ item, onClose }: { item: ReviewableItem; onClose: () => void }) {
  const [create, state] = useCreateReviewMutation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const submit = async () => {
    try {
      await create({ productId: item.productId, rating, comment: comment.trim() || undefined, imageUrls: photos }).unwrap();
      Alert.alert('Thanks for your review!');
      onClose();
    } catch (e) {
      Alert.alert(errorMessage(e));
    }
  };
  return (
    <Sheet open title="Write a review" onClose={onClose}>
      <View className="flex-row items-center gap-3">
        <Image source={item.imageUrl ? img(item.imageUrl, 56) : undefined} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: colors.canvas }} />
        <Text numberOfLines={2} className="flex-1 text-sm text-ink-800">{item.title}</Text>
      </View>
      <View className="items-center gap-1">
        <View className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} accessibilityLabel={`${n} stars`} hitSlop={4}>
              <Star size={36} color={colors.warning} fill={n <= rating ? colors.warning : 'transparent'} />
            </Pressable>
          ))}
        </View>
        <Text className="text-sm font-semibold text-ink-700">{WORDS[rating]}</Text>
      </View>
      <TextInput
        className="min-h-28 rounded-lg border border-ink-200 bg-white p-3 text-base text-ink-900"
        multiline
        textAlignVertical="top"
        placeholder="What did you like or dislike? (optional)"
        value={comment}
        onChangeText={setComment}
        maxLength={2000}
        accessibilityLabel="Your review"
      />
      <PhotoPicker value={photos} onChange={setPhotos} folder="reviews" />
      <Button title="Submit review" onPress={() => void submit()} loading={state.isLoading} />
    </Sheet>
  );
}

/** My Reviews: delivered items waiting for a review, and reviews already written. */
export default function MyReviewsScreen() {
  const ready = useRequireAuth('/reviews');
  const [tab, setTab] = useState<'to' | 'history'>('to');
  const pending = usePendingReviewsQuery(undefined, { skip: !ready });
  const mine = useMyReviewsQuery({ limit: 50 }, { skip: !ready || tab !== 'history' });
  const [writing, setWriting] = useState<ReviewableItem | null>(null);
  if (!ready || pending.isLoading) return <Loading />;
  const q = tab === 'to' ? pending : mine;

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: 'My Reviews' }} />
      <UnderlineTabs
        tabs={[
          { key: 'to', label: 'To Review', count: pending.data?.length },
          { key: 'history', label: 'History' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}>
        {tab === 'to' ? (
          !pending.data?.length ? (
            <EmptyReviews title="No Products to Review Yet" />
          ) : (
            pending.data.map((i) => (
              <View key={`${i.orderId}-${i.productId}`} className="flex-row items-center gap-3 rounded-xl bg-white p-3">
                <Image source={i.imageUrl ? img(i.imageUrl, 56) : undefined} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: colors.canvas }} />
                <View className="flex-1">
                  <Text numberOfLines={2} className="text-sm text-ink-800">{i.title}</Text>
                  <Text className="text-xs text-ink-500">
                    {i.variantLabel !== 'Default' ? `${i.variantLabel} · ` : ''}
                    {i.deliveredAt ? `Delivered ${fmtDate(i.deliveredAt)}` : i.orderNumber}
                  </Text>
                </View>
                <Pressable onPress={() => setWriting(i)} className="rounded-md bg-accent-500 px-3 py-2">
                  <Text className="text-xs font-semibold text-white">Review</Text>
                </Pressable>
              </View>
            ))
          )
        ) : mine.isLoading ? (
          <Loading />
        ) : !mine.data?.items.length ? (
          <EmptyReviews title="You haven't written any reviews yet" />
        ) : (
          mine.data.items.map((r) => (
            <Pressable key={r.id} onPress={() => r.product && router.push(`/product/${r.product.slug}`)} className="gap-2 rounded-xl bg-white p-3">
              {r.product ? <Text numberOfLines={1} className="text-sm font-semibold text-ink-900">{r.product.title}</Text> : null}
              <View className="flex-row items-center gap-2">
                <Stars value={r.rating} size={14} />
                <Text className="text-xs text-ink-500">{fmtDate(r.createdAt)}</Text>
                {!r.isVisible ? <Text className="text-xs text-ink-400">· Hidden</Text> : null}
              </View>
              {r.comment ? <Text className="text-sm text-ink-700">{r.comment}</Text> : null}
              {r.sellerReply ? (
                <View className="rounded-md border-l-2 border-primary-600 bg-primary-50 px-3 py-2">
                  <Text className="text-xs font-semibold text-primary-800">Seller’s response</Text>
                  <Text className="mt-0.5 text-sm text-ink-700">{r.sellerReply}</Text>
                </View>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
      {writing ? <WriteSheet item={writing} onClose={() => setWriting(null)} /> : null}
    </View>
  );
}
