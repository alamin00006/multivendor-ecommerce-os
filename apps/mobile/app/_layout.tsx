import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/components/ui';
import { I18nProvider } from '@/i18n';
import { BrandThemeProvider, useBrandColors } from '@/lib/brand-theme';
import { StoreProvider } from '@/lib/store-provider';

function AppStack() {
  const brand = useBrandColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: brand.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <StoreProvider>
            <StatusBar style="light" />
            <BrandThemeProvider>
              <AppStack />
            </BrandThemeProvider>
          </StoreProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
