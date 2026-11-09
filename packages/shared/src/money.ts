import { CURRENCY } from './constants.js';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const toBanglaDigits = (input: string): string =>
  input.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);

/** Convert taka (may be fractional) to integer poisha. */
export const toPoisha = (taka: number): number => Math.round(taka * CURRENCY.minorUnitsPerMajor);

/** Convert integer poisha to taka. */
export const fromPoisha = (poisha: number): number => poisha / CURRENCY.minorUnitsPerMajor;

export interface FormatBdtOptions {
  locale?: 'en' | 'bn';
  /** Show decimals only when the amount has poisha ("auto", default) or always. */
  decimals?: 'auto' | 'always';
}

/** Format poisha as BDT, e.g. 125000 → "৳1,250". */
export const formatBDT = (poisha: number, options: FormatBdtOptions = {}): string => {
  const { locale = 'en', decimals = 'auto' } = options;
  const taka = fromPoisha(poisha);
  const hasFraction = poisha % CURRENCY.minorUnitsPerMajor !== 0;
  const digits = decimals === 'always' || hasFraction ? 2 : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(taka));
  const value = `${taka < 0 ? '-' : ''}${CURRENCY.symbol}${formatted}`;
  return locale === 'bn' ? toBanglaDigits(value) : value;
};

/** Whole-number discount percentage between compare-at and sale price. */
export const discountPercent = (price: number, compareAtPrice: number | null | undefined): number => {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
};
