/**
 * MarketBD design tokens — single source of truth for web (Tailwind v4 @theme)
 * and mobile (NativeWind / Tailwind v3 preset). Original palette: a deep
 * "paddy green" primary with a warm coral accent.
 */
export const colors = {
  primary: {
    50: '#ecfdf6', 100: '#d1faea', 200: '#a6f3d6', 300: '#6de6bd', 400: '#34cf9e',
    500: '#10b484', 600: '#07926c', 700: '#08755a', 800: '#0b5d49', 900: '#0b4c3d', 950: '#032b23',
  },
  accent: {
    50: '#fff4f1', 100: '#ffe6df', 200: '#ffd0c4', 300: '#ffae9a', 400: '#fd7f61',
    500: '#f55a36', 600: '#e23d18', 700: '#be3011', 800: '#9c2b13', 900: '#812917', 950: '#461107',
  },
  ink: {
    50: '#f6f7f9', 100: '#eceef2', 200: '#d5d9e2', 300: '#b0b8c9', 400: '#8592ab',
    500: '#667391', 600: '#515c78', 700: '#424b62', 800: '#394053', 900: '#1f2430', 950: '#12151c',
  },
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  info: '#2563eb',
  flash: '#ff3d57',
  surface: '#ffffff',
  canvas: '#f3f5f7',
};

export const radius = { sm: '4px', md: '8px', lg: '12px', xl: '16px', pill: '999px' };

export const fontFamily = {
  sans: ['"Hind Siliguri"', 'Inter', 'system-ui', 'sans-serif'],
  display: ['Poppins', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
};

export const shadow = {
  card: '0 1px 2px rgba(18,21,28,0.06), 0 1px 3px rgba(18,21,28,0.08)',
  raised: '0 6px 16px rgba(18,21,28,0.12)',
};

export const layout = { container: '1320px', header: '1880px', headerHeight: '64px' };

export const tokens = { colors, radius, fontFamily, shadow, layout };
export default tokens;
