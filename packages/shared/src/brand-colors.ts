import { z } from 'zod';

/** The two brand colours. `primary` is shade 700 (buttons, header, links); `accent` is shade 500 (prices, offers). */
export interface BrandTheme {
  primary: string;
  accent: string;
}

/** Colours the hand-tuned scales in packages/config/tokens/theme.css were built from. */
export const DEFAULT_BRAND_COLORS: BrandTheme = { primary: '#08755a', accent: '#f55a36' };

export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #08755a')
  .transform((v) => v.toLowerCase());

export const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Shade = (typeof BRAND_SHADES)[number];

const toRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
/** `t` of `other` mixed into `hex` (0 = hex, 1 = other). */
const mix = (hex: string, other: [number, number, number], t: number) => toHex(toRgb(hex).map((c, i) => c + (other[i]! - c) * t));

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * Tint/shade steps per shade. Negative = mix with white, positive = mix with black.
 * The anchor shade is the colour itself (primary sits at 700, accent at 500).
 */
const STEPS: Record<'primary' | 'accent', Record<Shade, number>> = {
  primary: { 50: -0.94, 100: -0.87, 200: -0.74, 300: -0.57, 400: -0.38, 500: -0.22, 600: -0.1, 700: 0, 800: 0.2, 900: 0.36, 950: 0.62 },
  accent: { 50: -0.95, 100: -0.89, 200: -0.78, 300: -0.6, 400: -0.32, 500: 0, 600: 0.12, 700: 0.27, 800: 0.4, 900: 0.5, 950: 0.72 },
};

/** The hand-tuned default scales (same values as packages/config/tokens/theme.css). */
const DEFAULT_SCALES: Record<'primary' | 'accent', Record<Shade, string>> = {
  primary: { 50: '#ecfdf6', 100: '#d1faea', 200: '#a6f3d6', 300: '#6de6bd', 400: '#34cf9e', 500: '#10b484', 600: '#07926c', 700: '#08755a', 800: '#0b5d49', 900: '#0b4c3d', 950: '#032b23' },
  accent: { 50: '#fff4f1', 100: '#ffe6df', 200: '#ffd0c4', 300: '#ffae9a', 400: '#fd7f61', 500: '#f55a36', 600: '#e23d18', 700: '#be3011', 800: '#9c2b13', 900: '#812917', 950: '#461107' },
};

/** Full 50–950 scale for one brand colour (the hand-tuned scale for the default colour). */
export const brandScale = (hex: string, kind: 'primary' | 'accent'): Record<Shade, string> =>
  hex.toLowerCase() === DEFAULT_BRAND_COLORS[kind]
    ? DEFAULT_SCALES[kind]
    : (Object.fromEntries(
    BRAND_SHADES.map((shade) => {
      const t = STEPS[kind][shade];
      return [shade, t === 0 ? hex.toLowerCase() : t < 0 ? mix(hex, WHITE, -t) : mix(hex, BLACK, t)];
    }),
  ) as Record<Shade, string>);

/**
 * CSS custom properties that re-theme Tailwind's `primary-*` / `accent-*` utilities.
 * By default colours equal to the defaults are skipped (the stylesheet already has them);
 * `full` writes both scales, so a later rule can also switch a custom colour back to the default.
 */
export const brandCssVars = (theme: BrandTheme, { full = false }: { full?: boolean } = {}): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const kind of ['primary', 'accent'] as const) {
    if (!full && theme[kind].toLowerCase() === DEFAULT_BRAND_COLORS[kind]) continue;
    const scale = brandScale(theme[kind], kind);
    for (const shade of BRAND_SHADES) vars[`--color-${kind}-${shade}`] = scale[shade];
  }
  return vars;
};

/** `:root { … }` rule for server rendering (empty when both colours are the defaults). */
export const brandCss = (theme: BrandTheme, options: { full?: boolean } = {}): string => {
  const entries = Object.entries(brandCssVars(theme, options));
  return entries.length ? `:root{${entries.map(([k, v]) => `${k}:${v}`).join(';')}}` : '';
};

const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colours (1–21). White text needs ≥ 4.5 for body text, ≥ 3 for large text. */
export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
