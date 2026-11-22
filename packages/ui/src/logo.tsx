import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@marketbd/shared';

/**
 * Brand logo. The image files live in each Next app's public/brand/ folder:
 * logo.png (wordmark), logo-light.png (for dark backgrounds) and logo-full.png (with the tagline).
 */
export function Logo({
  className = '',
  light = false,
  withTagline = false,
}: {
  className?: string;
  /** White wordmark for dark backgrounds (panel sidebar). */
  light?: boolean;
  /** Wordmark + "যা লাগবে, আরওলাগবে-তে" underneath. */
  withTagline?: boolean;
}) {
  const src = withTagline ? '/brand/logo-full.png' : light ? '/brand/logo-light.png' : '/brand/logo.png';
  const [w, h] = withTagline ? [719, 215] : [719, 131];
  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label={`${BRAND.name} home`}>
      <Image
        src={src}
        alt={BRAND.nameBn}
        width={w}
        height={h}
        priority
        unoptimized
        className={withTagline ? 'h-16 w-auto' : 'h-7 w-auto sm:h-8'}
      />
    </Link>
  );
}
