import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Inter, Poppins } from 'next/font/google';
import { BRAND, type BrandTheme, DEFAULT_BRAND_COLORS } from '@marketbd/shared';
import { AppProviders, BrandStyle } from '@marketbd/ui';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Fallback for the Taka sign (৳) and Bangla text, which Inter does not include.
const hind = Hind_Siliguri({ subsets: ['bengali'], weight: ['400', '600', '700'], variable: '--font-hind' });
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins' });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} Admin`, template: `%s | ${BRAND.name} Admin` },
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/brand/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/brand/icon-192.png',
  },
};

/** Brand colours from Admin → Settings, read on the server so the first paint uses them. */
async function getBrandTheme(): Promise<BrandTheme> {
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1/settings/public`, { next: { revalidate: 15 } });
    if (!res.ok) return DEFAULT_BRAND_COLORS;
    return ((await res.json()) as { data?: { theme?: BrandTheme } }).data?.theme ?? DEFAULT_BRAND_COLORS;
  } catch {
    return DEFAULT_BRAND_COLORS;
  }
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await getBrandTheme()).primary, width: 'device-width', initialScale: 1 };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getBrandTheme();
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${hind.variable}`}>
      <head>
        <BrandStyle theme={theme} />
      </head>
      <body className="min-h-dvh font-sans">
        <AppProviders locale="en" chatOrigin={process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000'}>{children}</AppProviders>
      </body>
    </html>
  );
}
