import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePublicSettingsQuery } from '@marketbd/api-client';
import { type BrandTheme, brandScale, DEFAULT_BRAND_COLORS, HexColorSchema } from '@marketbd/shared';
import { vars } from 'nativewind';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { colors } from '@/components/ui';

const STORAGE_KEY = 'mbd_brand_theme';
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export interface BrandColors {
  primary: string;
  primaryDark: string;
  accent: string;
}

const BrandContext = createContext<BrandColors>({ primary: colors.primary, primaryDark: colors.primaryDark, accent: colors.accent });

/** Brand colours for navigator options and other places that need plain values. */
export const useBrandColors = () => useContext(BrandContext);

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const valid = (t: unknown): t is BrandTheme =>
  !!t && typeof t === 'object' && HexColorSchema.safeParse((t as BrandTheme).primary).success && HexColorSchema.safeParse((t as BrandTheme).accent).success;

/** Applies the brand colours from Admin → Settings to the whole app (cached for the next launch). */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings } = usePublicSettingsQuery();
  const [cached, setCached] = useState<BrandTheme | null | undefined>(undefined);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        setCached(valid(parsed) ? parsed : null);
      })
      .catch(() => setCached(null));
  }, []);

  const live = settings?.theme;
  useEffect(() => {
    if (live && valid(live)) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ primary: live.primary, accent: live.accent }));
  }, [live]);

  const theme: BrandTheme = (live && valid(live) ? live : cached) ?? DEFAULT_BRAND_COLORS;
  const key = `${theme.primary}-${theme.accent}`;

  const value = useMemo(() => {
    const p = brandScale(theme.primary, 'primary');
    const a = brandScale(theme.accent, 'accent');
    const style = vars(
      Object.fromEntries([
        ...SHADES.map((s) => [`--color-primary-${s}`, rgb(p[s])]),
        ...SHADES.map((s) => [`--color-accent-${s}`, rgb(a[s])]),
      ]),
    );
    return { style, brand: { primary: p[700], primaryDark: p[800], accent: a[500] } };
  }, [theme.primary, theme.accent]);

  // Icons and native views read the shared `colors` object; keep it in step with the theme.
  useMemo(() => Object.assign(colors, value.brand), [value]);

  if (cached === undefined) return null; // a few ms while the cached theme loads, avoids a colour flash
  return (
    <BrandContext.Provider value={value.brand}>
      {/* Remount on a theme change so every screen picks up the new icon colours. */}
      <View key={key} style={[{ flex: 1 }, value.style]}>
        {children}
      </View>
    </BrandContext.Provider>
  );
}
