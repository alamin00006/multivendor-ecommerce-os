import { BRAND } from '@marketbd/shared';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

/**
 * Opens the bKash / SSLCommerz page in an auth session. The API redirects back to
 * marketbd://checkout/result?status=...&order=... which closes the browser.
 */
export async function openPayment(redirectUrl: string, orderId: string): Promise<void> {
  const returnUrl = `${BRAND.deepLinkScheme}://checkout/result`;
  const result = await WebBrowser.openAuthSessionAsync(redirectUrl, returnUrl);
  if (result.type === 'success') {
    const { queryParams } = Linking.parse(result.url);
    const status = typeof queryParams?.status === 'string' ? queryParams.status : 'failed';
    router.replace({ pathname: '/checkout/result', params: { status, order: orderId } });
  } else {
    router.replace({ pathname: '/checkout/result', params: { status: 'cancelled', order: orderId } });
  }
}
