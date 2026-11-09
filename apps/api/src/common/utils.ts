import { randomBytes } from 'node:crypto';

export const slugify = (input: string): string =>
  input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);

/** Short random suffix for unique slugs, e.g. "x7k2". */
export const randomSuffix = (length = 4): string =>
  randomBytes(length).toString('base64url').replace(/[-_]/g, '').toLowerCase().slice(0, length).padEnd(length, '0');

/** Human-friendly order number: MBD-YYMMDD-XXXXXX. */
export const generateOrderNumber = (now = new Date()): string => {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rand = randomBytes(4).readUInt32BE(0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return `MBD-${yy}${mm}${dd}-${rand}`;
};

export const toIso = (date: Date | null | undefined): string | null => (date ? date.toISOString() : null);

/** Decimal-like (Prisma.Decimal) or number → number. */
export const num = (value: { toNumber(): number } | number | null | undefined): number =>
  value == null ? 0 : typeof value === 'number' ? value : value.toNumber();

export const variantLabel = (attributes: unknown): string => {
  if (!attributes || typeof attributes !== 'object') return 'Default';
  const values = Object.values(attributes as Record<string, unknown>).filter((v) => typeof v === 'string');
  return values.length ? values.join(' / ') : 'Default';
};

export const asAttributes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
};
