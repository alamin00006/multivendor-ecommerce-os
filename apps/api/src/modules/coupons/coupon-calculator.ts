import { formatBDT, type PaymentMethod } from '@marketbd/shared';

const METHOD_NAME: Record<PaymentMethod, string> = { COD: 'Cash on Delivery', BKASH: 'bKash', SSLCOMMERZ: 'card / mobile banking', CASH: 'cash' };

export interface CouponRule {
  code: string;
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  scope: 'PLATFORM' | 'STORE' | 'PAYMENT';
  sellerId: string | null;
  paymentMethod: PaymentMethod | null;
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

/** One package of the order (one per shop). */
export interface VoucherGroup {
  sellerId: string;
  subtotal: number;
  shippingFee: number;
}

export interface VoucherContext {
  groups: VoucherGroup[];
  /** Chosen method; omitted while the customer has not picked one (checked as Cash on Delivery). */
  paymentMethod?: PaymentMethod;
  /** Display name of the shop for STORE vouchers, used in messages. */
  shopName?: string;
}

export type CouponCheck =
  | {
      ok: true;
      discount: number;
      /** Discount per group, in the same order as `ctx.groups`. */
      allocation: number[];
      /** Whether the discount comes off item prices or the delivery fee. */
      appliesTo: 'items' | 'shipping';
    }
  | { ok: false; reason: string };

/** Splits a discount across groups proportionally to their weights (largest remainder). */
export const allocateDiscount = (discount: number, weights: number[]): number[] => {
  const total = weights.reduce((a, b) => a + b, 0);
  if (discount <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((s) => (discount * s) / total);
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

/**
 * Pure voucher evaluation for an order split into shop packages.
 * - PLATFORM / PAYMENT vouchers cover the whole order; PAYMENT also needs the matching method.
 * - STORE vouchers cover only that shop's package (minimum spend counts that shop's items only).
 * - FREE_SHIPPING takes the discount off delivery fees (capped by `value`, 0 = no cap) instead of items.
 * `userUses` = how many times this user already redeemed it.
 */
export const evaluateCoupon = (coupon: CouponRule, ctx: VoucherContext, userUses: number, now = new Date()): CouponCheck => {
  if (!coupon.isActive || coupon.startsAt > now) return { ok: false, reason: 'This voucher is not active' };
  if (coupon.endsAt <= now) return { ok: false, reason: 'This voucher has expired' };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: 'This voucher has been fully redeemed' };
  }
  if (userUses >= coupon.perUserLimit) return { ok: false, reason: 'You have already used this voucher' };

  const eligible = ctx.groups.map((g) => coupon.scope !== 'STORE' || g.sellerId === coupon.sellerId);
  const base = ctx.groups.reduce((s, g, i) => s + (eligible[i] ? g.subtotal : 0), 0);
  if (coupon.scope === 'STORE' && base === 0) {
    return { ok: false, reason: `Add items from ${ctx.shopName ?? 'this shop'} to use this voucher` };
  }
  if (coupon.scope === 'PAYMENT' && coupon.paymentMethod && (ctx.paymentMethod ?? 'COD') !== coupon.paymentMethod) {
    return { ok: false, reason: `Pay with ${METHOD_NAME[coupon.paymentMethod]} to use this voucher` };
  }
  if (base < coupon.minOrderAmount) {
    return {
      ok: false,
      reason: `Minimum spend of ${formatBDT(coupon.minOrderAmount)}${coupon.scope === 'STORE' ? ` from ${ctx.shopName ?? 'this shop'}` : ''} required for this voucher`,
    };
  }

  if (coupon.type === 'FREE_SHIPPING') {
    const weights = ctx.groups.map((g, i) => (eligible[i] ? g.shippingFee : 0));
    const fees = weights.reduce((a, b) => a + b, 0);
    if (fees === 0) return { ok: false, reason: 'Delivery is already free for this order' };
    const discount = coupon.value > 0 ? Math.min(coupon.value, fees) : fees;
    return { ok: true, discount, allocation: allocateDiscount(discount, weights), appliesTo: 'shipping' };
  }

  const raw = coupon.type === 'PERCENTAGE' ? Math.floor((base * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
  const discount = Math.max(0, Math.min(capped, base));
  const weights = ctx.groups.map((g, i) => (eligible[i] ? g.subtotal : 0));
  return { ok: true, discount, allocation: allocateDiscount(discount, weights), appliesTo: 'items' };
};
