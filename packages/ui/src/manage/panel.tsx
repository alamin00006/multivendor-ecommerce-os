'use client';

import { storeUrl } from '../urls';
import { selectUser, useLogoutMutation } from '@marketbd/api-client';
import { BANGLA_ENABLED, type Role } from '@marketbd/shared';
import { ExternalLink, LogOut, Menu, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useSelector } from 'react-redux';
import { RequireAuth } from '../require-auth';
import { Logo } from '../logo';
import { useI18n } from '../i18n';
import { Button, cn } from '../primitives';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

/** Sidebar layout shared by the seller and admin panels. */
export function PanelLayout({
  title,
  nav,
  roles,
  children,
}: {
  title: string;
  nav: NavItem[];
  roles: Role[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const [logout] = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const { t, setLocale, locale } = useI18n();

  const sidebar = (
    <nav className="flex flex-col gap-0.5 p-3">
      {nav.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
              active ? 'bg-primary-700 font-semibold text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white',
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <RequireAuth roles={roles}>
      <div className="flex min-h-dvh bg-canvas">
        <aside className="hidden w-60 shrink-0 bg-ink-950 lg:block">
          <div className="flex h-14 items-center border-b border-ink-800 px-4">
            <Logo light />
          </div>
          <p className="px-6 pt-4 text-xs uppercase tracking-wider text-ink-500">{title}</p>
          {sidebar}
        </aside>
        {open && (
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-64 bg-ink-950" onClick={(e) => e.stopPropagation()}>
              <div className="flex h-14 items-center border-b border-ink-800 px-4">
                <Logo light />
              </div>
              {sidebar}
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-100 bg-white px-4">
            <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <Menu className="size-5" />
            </button>
            <h1 className="font-semibold">{title}</h1>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {BANGLA_ENABLED && (
                <button
                  type="button"
                  onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
                  className="text-xs font-semibold text-ink-600"
                >
                  {t.common.language}
                </button>
              )}
              <Link href={storeUrl("/")} className="hidden items-center gap-1 text-ink-600 hover:text-primary-700 sm:flex">
                <ExternalLink className="size-4" /> Storefront
              </Link>
              <span className="hidden text-ink-500 md:inline">{user?.name}</span>
              <Button size="sm" variant="ghost" onClick={() => void logout()} aria-label={t.common.signOut}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'primary' | 'accent' | 'info' | 'warning';
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700',
    accent: 'bg-accent-50 text-accent-600',
    info: 'bg-blue-50 text-blue-600',
    warning: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={cn('rounded-lg p-3', tones[tone])}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-500">{label}</p>
        <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-4 py-3 text-sm">
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ Prev
      </Button>
      <span>
        {page} / {totalPages}
      </span>
      <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next ›
      </Button>
    </div>
  );
}

/** Standard table wrapper with horizontal scroll on small screens. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
