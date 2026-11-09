import { formatBDT } from '@marketbd/shared';

export interface CouponRule {
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}

export type CouponCheck = { ok: true; discount: number } | { ok: false; reason: string };

/** Pure coupon evaluation. `userUses` = how many times this user already redeemed it. */
export const evaluateCoupon = (
  coupon: CouponRule,
  subtotal: number,
  userUses: number,
  now = new Date(),
): CouponCheck => {
  if (!coupon.isActive || coupon.startsAt > now) return { ok: false, reason: 'This coupon is not active' };
  if (coupon.endsAt <= now) return { ok: false, reason: 'This coupon has expired' };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: 'This coupon has been fully redeemed' };
  }
  if (userUses >= coupon.perUserLimit) return { ok: false, reason: 'You have already used this coupon' };
  if (subtotal < coupon.minOrderAmount) {
    return { ok: false, reason: `Minimum order of ${formatBDT(coupon.minOrderAmount)} required for this coupon` };
  }
  const raw = coupon.type === 'PERCENTAGE' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
  return { ok: true, discount: Math.max(0, Math.min(capped, subtotal)) };
};

/** Splits a discount across groups proportionally to their subtotals (largest remainder). */
export const allocateDiscount = (discount: number, subtotals: number[]): number[] => {
  const total = subtotals.reduce((a, b) => a + b, 0);
  if (discount <= 0 || total <= 0) return subtotals.map(() => 0);
  const exact = subtotals.map((s) => (discount * s) / total);
  const floored = exact.map(Math.floor);
  let remainder = discount - floored.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] = (floored[i] ?? 0) + 1;
    remainder -= 1;
  }
  return floored;
};
