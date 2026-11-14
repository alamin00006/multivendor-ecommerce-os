import Link from 'next/link';
import { BRAND } from '@marketbd/shared';

/** Placeholder brand mark — swap the SVG for the real logo. Name comes from BRAND. */
export function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label={`${BRAND.name} home`}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? '#ffffff' : '#08755a'} />
        <path d="M16 44V22l8 0 8 12 8-12h8v22h-7V32l-9 12-9-12v12z" fill={light ? '#08755a' : '#ffffff'} />
        <circle cx="50" cy="16" r="5" fill="#f55a36" />
      </svg>
      <span className={`font-display text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-primary-800'}`}>
        {BRAND.name}
      </span>
    </Link>
  );
}
