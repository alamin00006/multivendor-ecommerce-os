'use client';

import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { dictionaries, type Dictionary, formatBDT, LOCALE_COOKIE, type UiLocale as Locale } from '@marketbd/shared';

interface I18nValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  /** Formats poisha as BDT in the current locale. */
  money: (poisha: number) => string;
  /** Picks the Bangla variant of a field when available. */
  pick: (en: string, bn: string | null | undefined) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: dictionaries[locale],
      setLocale,
      money: (p) => formatBDT(p, { locale }),
      pick: (enText, bnText) => (locale === 'bn' && bnText ? bnText : enText),
    }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
