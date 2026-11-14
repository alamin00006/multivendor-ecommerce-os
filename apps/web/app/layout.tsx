import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Inter, Poppins } from 'next/font/google';
import { BRAND } from '@marketbd/shared';
import { AppProviders } from '@marketbd/ui';
import { getLocale } from '@/i18n/server';
import { SITE_URL } from '@/lib/server-api';
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
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#08755a', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${hind.variable} ${inter.variable} ${poppins.variable}`}>
      <body className="min-h-dvh font-sans">
        <AppProviders locale={locale} guestCart>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
