import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Inter, Poppins } from 'next/font/google';
import { BRAND } from '@marketbd/shared';
import { AppProviders, BrandStyle } from '@marketbd/ui';
import { getLocale } from '@/i18n/server';
import { getBrandTheme, SITE_URL } from '@/lib/server-api';
import './globals.css';

const hind = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-hind' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name} — Online shopping in Bangladesh`, template: `%s | ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  openGraph: { siteName: BRAND.name, type: 'website', locale: 'en_BD' },
  icons: {
    icon: [
      { url: '/brand/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/brand/icon-192.png',
  },
};

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await getBrandTheme()).primary, width: 'device-width', initialScale: 1 };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, theme] = await Promise.all([getLocale(), getBrandTheme()]);
  return (
    <html lang={locale} className={`${hind.variable} ${inter.variable} ${poppins.variable}`}>
      <head>
        <BrandStyle theme={theme} />
      </head>
      <body className="min-h-dvh font-sans">
        <AppProviders locale={locale} guestCart chatOrigin={process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000'}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
