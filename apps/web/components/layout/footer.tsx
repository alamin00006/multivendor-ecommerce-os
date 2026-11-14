'use client';

import { useMarketplaceMode, usePublicSettingsQuery } from '@marketbd/api-client';
import { BRAND } from '@marketbd/shared';
import { Clock, Mail, MapPin, Phone, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useHydrated, useI18n } from '@marketbd/ui';
import { Logo } from '@marketbd/ui';

const SOCIAL_BADGES = [
  { key: 'facebook', label: 'f' },
  { key: 'instagram', label: 'ig' },
  { key: 'youtube', label: 'yt' },
  { key: 'tiktok', label: 'tt' },
  { key: 'linkedin', label: 'in' },
] as const;

const PAYMENT_LABELS = ['AMEX', 'Mastercard', 'VISA', 'bKash', 'Nagad', 'Rocket', 'Upay', 'Cash on Delivery'];

export function Footer() {
  const { t } = useI18n();
  const { sellerFeatures } = useMarketplaceMode();
  const { data: settings } = usePublicSettingsQuery();
  const store = useHydrated() ? settings?.store : undefined;
  const phone = store?.phone || BRAND.supportPhone;
  const email = store?.email || BRAND.supportEmail;
  const socials = SOCIAL_BADGES.filter((s) => store?.social[s.key]);
  return (
    <footer className="mt-10 border-t border-ink-100 bg-white pb-20 text-ink-600 md:pb-0">
      <div className="container-site grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-2.5 text-sm">
          <Logo />
          {store?.address && (
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary-700" /> {store.address}
            </p>
          )}
          <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:text-primary-700">
            <Phone className="size-4 text-primary-700" /> {phone}
          </a>
          {store?.hours && (
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-primary-700" /> {store.hours}
            </p>
          )}
          <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-primary-700">
            <Mail className="size-4 text-primary-700" /> {email}
          </a>
          {socials.length > 0 && (
            <>
              <p className="pt-2 font-semibold text-ink-800">{t.footer.followUs}</p>
              <div className="flex gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={store!.social[s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.key}
                    className="grid size-8 place-items-center rounded-full border border-ink-200 text-[11px] font-bold uppercase text-ink-600 hover:border-primary-600 hover:text-primary-700"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-ink-900">{t.footer.about}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/help/about" className="hover:text-primary-700">{t.footer.aboutUs}</Link></li>
            <li><Link href="/help/careers" className="hover:text-primary-700">{t.footer.careers}</Link></li>
            <li><Link href="/help/privacy" className="hover:text-primary-700">{t.footer.privacy}</Link></li>
            {sellerFeatures && (
              <li><Link href="/sell" className="hover:text-primary-700">{t.footer.sell}</Link></li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-ink-900">{t.footer.care}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/help/returns" className="hover:text-primary-700">{t.footer.returns}</Link></li>
            <li><Link href="/help/terms" className="hover:text-primary-700">{t.footer.terms}</Link></li>
            <li><Link href="/help" className="hover:text-primary-700">{t.common.helpCenter}</Link></li>
            <li><Link href="/help" className="hover:text-primary-700">{t.footer.contact}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-ink-900">{t.footer.installApp}</h3>
          <p className="mb-3 text-xs text-ink-500">{t.footer.appOffer}</p>
          <div className="flex gap-3">
            <div className="grid size-24 place-items-center rounded-lg border border-ink-200">
              <QrCode className="size-16 text-ink-800" aria-label="App download QR code" />
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <span className="rounded-md bg-ink-900 px-3 py-2 font-semibold text-white">App Store</span>
              <span className="rounded-md bg-ink-900 px-3 py-2 font-semibold text-white">Google Play</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="container-site flex flex-wrap items-center justify-center gap-2 py-4 text-xs">
          <span className="mr-2 font-semibold text-ink-700">{t.footer.pay}</span>
          {PAYMENT_LABELS.map((p) => (
            <span key={p} className="rounded border border-ink-200 px-2 py-1 font-semibold text-ink-700">
              {p}
            </span>
          ))}
        </div>
        <p className="container-site pb-5 text-center text-xs text-ink-500 md:text-right">
          © {new Date().getFullYear()} {BRAND.name}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
