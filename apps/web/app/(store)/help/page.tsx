import { BRAND, HELP_SHORTCUTS, type HelpShortcutKey, helpContext, helpTopics, type PublicSettings } from '@marketbd/shared';
import { Bell, CreditCard, KeyRound, type LucideIcon, Mail, MapPin, PackageSearch, PackageX, Phone, RotateCcw, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpTopics } from '@/components/help/help-topics';
import { apiGet } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Help Center' };

const ICONS: Record<HelpShortcutKey, LucideIcon> = {
  profile: UserRound,
  'to-pay': CreditCard,
  addresses: MapPin,
  orders: PackageSearch,
  cancel: PackageX,
  returns: RotateCcw,
  password: KeyRound,
  notifications: Bell,
};

/** Help Center: greeting banner, account shortcuts, topics with questions, and a call button. */
export default async function HelpCenterPage() {
  const ctx = helpContext(await apiGet<PublicSettings>('/settings/public', { revalidate: 60 }));
  return (
    <div className="container-site space-y-4 pt-4">
      <h1 className="font-display text-xl font-semibold text-ink-900">Help Center</h1>
      <div className="-mx-3 bg-primary-700 px-4 py-4 text-white md:mx-0 md:rounded-lg md:py-5 md:text-center">
        <p className="text-base font-semibold md:text-sm md:font-normal">Welcome to {BRAND.name} Help Center</p>
        <p className="mt-0.5 text-sm md:text-xl md:font-semibold">Hi, How can we help?</p>
      </div>

      <nav aria-label="Account shortcuts" className="card grid grid-cols-4 gap-y-4 px-2 py-5 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-6">
        {HELP_SHORTCUTS.map((s) => {
          const Icon = ICONS[s.key];
          return (
            <Link key={s.key} href={s.href} className="flex flex-col items-center gap-1.5 text-center text-[11px] font-medium text-ink-700 hover:text-primary-700 sm:w-20">
              <Icon className="size-7 text-ink-600" strokeWidth={1.6} />
              <span className="leading-tight">{s.label}</span>
            </Link>
          );
        })}
      </nav>

      <HelpTopics topics={helpTopics(ctx)} />

      <div className="space-y-3 pb-6 pt-4">
        <p className="text-sm text-ink-600">Didn&apos;t find what you were looking for?</p>
        <div className="flex flex-wrap gap-3">
          <a href={`tel:${ctx.supportPhone}`} className="flex items-center gap-4 rounded-lg bg-primary-700 px-8 py-3 text-white hover:bg-primary-800">
            <Phone className="size-7" />
            <span>
              <span className="block text-lg font-semibold leading-tight">Call Us</span>
              <span className="text-sm">at {ctx.supportPhone}</span>
            </span>
          </a>
          <a href={`mailto:${ctx.supportEmail}`} className="flex items-center gap-4 rounded-lg border border-primary-700 bg-white px-8 py-3 text-primary-700 hover:bg-primary-50">
            <Mail className="size-7" />
            <span>
              <span className="block text-lg font-semibold leading-tight">Email Us</span>
              <span className="text-sm">{ctx.supportEmail}</span>
            </span>
          </a>
        </div>
        <p className="text-xs text-ink-500">{ctx.hours}</p>
      </div>
    </div>
  );
}
