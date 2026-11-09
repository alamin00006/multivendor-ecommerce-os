import { useCampaignQuery } from '@marketbd/api-client';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, useWindowDimensions, View } from 'react-native';
import { Countdown } from '@/components/product-card';
import { ProductList } from '@/components/product-list';
import { ErrorView } from '@/components/ui';
import { useI18n } from '@/i18n';
import { img } from '@/lib/config';

export default function CampaignScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, pick } = useI18n();
  const { width } = useWindowDimensions();
  const { data: campaign, isError } = useCampaignQuery(slug);
  if (isError) return <ErrorView message={t.common.notFound} />;
  return (
    <View className="flex-1" style={{ backgroundColor: campaign?.themeColor ? `${campaign.themeColor}14` : undefined }}>
      <Stack.Screen options={{ title: campaign ? pick(campaign.title, campaign.titleBn) : '' }} />
      <ProductList
        params={{ campaign: slug, sort: 'popular' }}
        header={
          campaign ? (
            <View className="mb-2">
              <Image source={img(campaign.mobileBannerUrl ?? campaign.bannerUrl, width)} style={{ width, height: width / 2 }} contentFit="cover" />
              <View className="flex-row items-center justify-between bg-white px-3 py-2">
                <Text className="text-xs text-ink-500">{t.home.endsIn}</Text>
                <Countdown endsAt={campaign.endAt} />
              </View>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}
