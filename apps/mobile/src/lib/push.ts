import AsyncStorage from '@react-native-async-storage/async-storage';
import { selectAuth, useLogoutMutation, useRegisterPushTokenMutation, useRemovePushTokenMutation } from '@marketbd/api-client';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSelector } from 'react-redux';

const TOKEN_KEY = 'mbd_push_token';

// Show banners for notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: () => Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** EAS project id: needed by Expo to issue push tokens (set by `eas init`). */
const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Asks for permission and returns this device's Expo push token, or null when push is not possible here. */
async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // emulators / simulators cannot receive push
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Orders & messages', importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  const id = projectId();
  if (!id) {
    console.warn('Push notifications need an EAS project id: run `npx eas init` in apps/mobile.');
    return null;
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

/** Where a tapped notification should open, from the data the API attached. */
function openFromData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  if (typeof data.conversationId === 'string') router.push(`/chat/${data.conversationId}`);
  else if (typeof data.orderId === 'string') router.push(`/orders/${data.orderId}`);
  else if (typeof data.productSlug === 'string') router.push(`/product/${data.productSlug}`);
  else router.push('/notifications');
}

/** Registers the device for push after sign-in and opens the right screen when a notification is tapped. */
export function usePushNotifications() {
  const { status, user } = useSelector(selectAuth);
  const [register] = useRegisterPushTokenMutation();
  const handled = useRef<string | null>(null);
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getPushToken();
        if (!token || cancelled) return;
        await register({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }).unwrap();
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } catch (e) {
        console.warn('Push registration failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, register]);

  useEffect(() => {
    if (!response || status !== 'authenticated') return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    openFromData(response.notification.request.content.data);
  }, [response, status]);
}

/** Sign-out that first stops this phone from receiving the account's notifications. */
export function useSignOut() {
  const [logout, state] = useLogoutMutation();
  const [remove] = useRemovePushTokenMutation();
  const signOut = useCallback(async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      await remove({ token })
        .unwrap()
        .catch(() => undefined);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    await logout();
  }, [logout, remove]);
  return [signOut, state] as const;
}
