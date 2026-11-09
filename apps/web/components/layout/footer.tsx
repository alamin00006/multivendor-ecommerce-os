'use client';

import { useMarketplaceMode } from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { Logo } from './logo';

const PAYMENT_LABELS = ['bKash', 'Nagad', 'Visa', 'Mastercard', 'AMEX', 'COD'];

export function Footer() {
  const { t } = useI18n();
  const { sellerFeatures } = useMarketplaceMode();
  return (
    <footer className="mt-10 bg-ink-950 pb-20 text-ink-300 md:pb-0">
      <div className="container-site grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 text-sm">
          <Logo light />
          <p className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" /> House 1, Road 1, Gulshan 1, Dhaka 1212
          </p>
          <p className="flex gap-2">
            <Phone className="size-4" /> {BRAND.supportPhone} (9am – 9pm)
          </p>
          <p className="flex gap-2">
            <Mail className="size-4" /> {BRAND.supportEmail}
          </p>
          <div className="flex gap-3 pt-1">
            {['fb', 'ig', 'yt'].map((s) => (
              <span key={s} className="grid size-8 place-items-center rounded-full bg-ink-800 text-xs font-bold uppercase text-ink-200">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-white">{t.footer.about}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/help/about" className="hover:text-white">{t.footer.aboutUs}</Link></li>
            <li><Link href="/help/careers" className="hover:text-white">{t.footer.careers}</Link></li>
            {sellerFeatures && (
              <li><Link href="/sell" className="hover:text-white">{t.footer.sell}</Link></li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-white">{t.footer.care}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/help/returns" className="hover:text-white">{t.footer.returns}</Link></li>
            <li><Link href="/help/privacy" className="hover:text-white">{t.footer.privacy}</Link></li>
            <li><Link href="/help/terms" className="hover:text-white">{t.footer.terms}</Link></li>
            <li><Link href="/help" className="hover:text-white">{t.common.helpCenter}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-white">{t.footer.getApp}</h3>
          <div className="flex gap-3">
            <div className="grid size-20 place-items-center rounded-lg bg-white text-[10px] font-bold text-ink-900">QR</div>
            <div className="flex flex-col gap-2 text-xs">
              <span className="rounded-md border border-ink-700 px-3 py-2">App Store</span>
              <span className="rounded-md border border-ink-700 px-3 py-2">Google Play</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-ink-800">
        <div className="container-site flex flex-col items-center justify-between gap-3 py-4 text-xs md:flex-row">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1">{t.footer.pay}:</span>
            {PAYMENT_LABELS.map((p) => (
              <span key={p} className="rounded bg-white px-2 py-1 font-semibold text-ink-800">
                {p}
              </span>
            ))}
          </div>
          <p>
            © {new Date().getFullYear()} {BRAND.name}. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
