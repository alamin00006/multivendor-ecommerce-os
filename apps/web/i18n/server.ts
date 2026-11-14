import 'server-only';
import { BANGLA_ENABLED } from '@marketbd/shared';
import { cookies, headers } from 'next/headers';
import { dictionaries, isLocale, type Locale, LOCALE_COOKIE } from './index';

/** Locale from the cookie, falling back to the browser's Accept-Language. */
export async function getLocale(): Promise<Locale> {
  if (!BANGLA_ENABLED) return 'en';
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = (await headers()).get('accept-language') ?? '';
  return accept.toLowerCase().startsWith('bn') ? 'bn' : 'en';
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
