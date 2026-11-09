'use client';

import { clsx } from 'clsx';
import { Loader2, Star, X } from 'lucide-react';
import Link from 'next/link';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode, useEffect } from 'react';
import { useI18n } from '@/i18n/client';

export { clsx as cn };

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary-700 text-white hover:bg-primary-800 disabled:bg-primary-300',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 disabled:bg-accent-300',
  outline: 'border border-primary-700 text-primary-700 hover:bg-primary-50 disabled:opacity-50',
  ghost: 'text-ink-700 hover:bg-ink-100 disabled:opacity-50',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
  soft: 'bg-primary-50 text-primary-800 hover:bg-primary-100 disabled:opacity-50',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Price in BDT with optional struck-through compare-at price. */
export function Price({
  value,
  compareAt,
  size = 'md',
  className,
}: {
  value: number;
  compareAt?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const { money } = useI18n();
  const main = { sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-3xl' }[size];
  return (
    <span className={clsx('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={clsx('font-bold text-accent-600', main)}>{money(value)}</span>
      {compareAt && compareAt > value ? (
        <span className="text-xs text-ink-400 line-through">{money(compareAt)}</span>
      ) : null}
    </span>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center', className)} aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(value) ? 'fill-warning text-warning' : 'fill-ink-200 text-ink-200'}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'accent';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    primary: 'bg-primary-50 text-primary-800',
    accent: 'bg-accent-50 text-accent-700',
  };
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-ink-100', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-6 animate-spin text-primary-700', className)} aria-label="Loading" />;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-ink-300 [&>svg]:size-14">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink-800">{title}</h3>
      {text && <p className="max-w-sm text-sm text-ink-500">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-6 py-8 text-center">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-raised sm:rounded-xl', width)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-5 py-3">
          <h2 className="font-semibold text-ink-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-500 hover:bg-ink-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-ink-200">
      <button
        type="button"
        className="h-full w-9 text-lg text-ink-600 hover:bg-ink-50 disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        className="h-full w-9 text-lg text-ink-600 hover:bg-ink-50 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function SectionHeader({ title, href, action }: { title: ReactNode; href?: string; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-semibold text-ink-900 md:text-xl">{title}</h2>
      {action ??
        (href ? (
          <Link href={href} className="text-sm font-semibold text-primary-700 hover:underline">
            {t.common.seeAll}
          </Link>
        ) : null)}
    </div>
  );
}
