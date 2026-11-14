import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Inter, Poppins } from 'next/font/google';
import { BRAND } from '@marketbd/shared';
import { AppProviders } from '@marketbd/ui';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Fallback for the Taka sign (৳) and Bangla text, which Inter does not include.
const hind = Hind_Siliguri({ subsets: ['bengali'], weight: ['400', '600', '700'], variable: '--font-hind' });
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins' });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} Admin`, template: `%s | ${BRAND.name} Admin` },
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#08755a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${hind.variable}`}>
      <body className="min-h-dvh font-sans">
        <AppProviders locale="en">{children}</AppProviders>
      </body>
    </html>
  );
}
