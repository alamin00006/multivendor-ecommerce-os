import AsyncStorage from '@react-native-async-storage/async-storage';
import { BANGLA_ENABLED, type Dictionary, dictionaries, formatBDT, isUiLocale, type UiLocale } from '@marketbd/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'mbd_locale';

interface I18nValue {
  locale: UiLocale;
  t: Dictionary;
  setLocale: (l: UiLocale) => void;
  money: (poisha: number) => string;
  pick: (en: string, bn: string | null | undefined) => string;
}

const Ctx = createContext<I18nValue | null>(null);

let currentLocale: UiLocale = 'en';
/** Read by the API client for Accept-Language. */
export const getCurrentLocale = () => currentLocale;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>('en');

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (BANGLA_ENABLED && isUiLocale(v)) {
        currentLocale = v;
        setLocaleState(v);
      }
    });
  }, []);

  const setLocale = useCallback((l: UiLocale) => {
    currentLocale = l;
    setLocaleState(l);
    void AsyncStorage.setItem(KEY, l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: dictionaries[locale],
      setLocale,
      money: (p) => formatBDT(p, { locale }),
      pick: (en, bn) => (locale === 'bn' && bn ? bn : en),
    }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
