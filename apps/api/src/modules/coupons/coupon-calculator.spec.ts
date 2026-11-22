import { describe, expect, it } from 'vitest';
import { allocateDiscount, type CouponRule, evaluateCoupon, type VoucherContext } from './coupon-calculator.js';

const now = new Date('2026-06-01T00:00:00Z');
const base: CouponRule = {
  code: 'SAVE10',
  type: 'PERCENTAGE',
  scope: 'PLATFORM',
  sellerId: null,
  paymentMethod: null,
  value: 10,
  minOrderAmount: 200_000,
  maxDiscount: 50_000,
  usageLimit: 100,
  perUserLimit: 1,
  usedCount: 0,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2026-12-31T00:00:00Z'),
  isActive: true,
};
/** Single-package order. */
const one = (subtotal: number, shippingFee = 6_000): VoucherContext => ({ groups: [{ sellerId: 's1', subtotal, shippingFee }] });
/** Two shops: s1 (৳2,000 + ৳60 delivery) and s2 (৳1,000 + ৳60 delivery). */
const two: VoucherContext = {
  groups: [
    { sellerId: 's1', subtotal: 200_000, shippingFee: 6_000 },
    { sellerId: 's2', subtotal: 100_000, shippingFee: 6_000 },
  ],
};

describe('evaluateCoupon — platform vouchers', () => {
  it('applies a percentage discount to items', () => {
    expect(evaluateCoupon(base, one(300_000), 0, now)).toEqual({ ok: true, discount: 30_000, allocation: [30_000], appliesTo: 'items' });
  });

  it('caps percentage discounts at maxDiscount', () => {
    expect(evaluateCoupon(base, one(1_000_000), 0, now)).toMatchObject({ ok: true, discount: 50_000 });
  });

  it('applies a fixed discount but never more than the subtotal', () => {
    const fixed = { ...base, type: 'FIXED' as const, value: 500_000, minOrderAmount: 0, maxDiscount: null };
    expect(evaluateCoupon(fixed, one(300_000), 0, now)).toMatchObject({ ok: true, discount: 300_000 });
  });

  it('splits a platform discount across shops by their subtotals', () => {
    const fixed = { ...base, type: 'FIXED' as const, value: 30_000, minOrderAmount: 0, maxDiscount: null };
    expect(evaluateCoupon(fixed, two, 0, now)).toMatchObject({ ok: true, discount: 30_000, allocation: [20_000, 10_000] });
  });

  it('enforces the minimum spend', () => {
    const result = evaluateCoupon(base, one(100_000), 0, now);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('Minimum spend');
  });

  it('rejects expired, inactive, exhausted and already-used vouchers', () => {
    expect(evaluateCoupon({ ...base, endsAt: new Date('2026-05-01') }, one(300_000), 0, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, isActive: false }, one(300_000), 0, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, usedCount: 100 }, one(300_000), 0, now).ok).toBe(false);
    expect(evaluateCoupon(base, one(300_000), 1, now).ok).toBe(false);
  });
});

describe('evaluateCoupon — store vouchers', () => {
  const store: CouponRule = { ...base, scope: 'STORE', sellerId: 's2', minOrderAmount: 50_000, maxDiscount: null };

  it("discounts only the shop's own package, based on its own subtotal", () => {
    expect(evaluateCoupon(store, two, 0, now)).toEqual({ ok: true, discount: 10_000, allocation: [0, 10_000], appliesTo: 'items' });
  });

  it("counts only the shop's items toward the minimum spend", () => {
    const result = evaluateCoupon({ ...store, minOrderAmount: 150_000 }, { ...two, shopName: 'Deshi Bazar' }, 0, now);
    expect(!result.ok && result.reason).toContain('from Deshi Bazar');
  });

  it('fails when the cart has nothing from that shop', () => {
    const result = evaluateCoupon(store, one(300_000), 0, now);
    expect(!result.ok && result.reason).toContain('Add items from');
  });
});

describe('evaluateCoupon — free delivery', () => {
  const ship: CouponRule = { ...base, type: 'FREE_SHIPPING', value: 0, minOrderAmount: 0, maxDiscount: null };

  it('waives every delivery fee when uncapped', () => {
    expect(evaluateCoupon(ship, two, 0, now)).toEqual({ ok: true, discount: 12_000, allocation: [6_000, 6_000], appliesTo: 'shipping' });
  });

  it('caps the waiver at the voucher value', () => {
    expect(evaluateCoupon({ ...ship, value: 5_000 }, one(100_000), 0, now)).toMatchObject({ ok: true, discount: 5_000 });
  });

  it("a store's free delivery covers only that shop's package", () => {
    expect(evaluateCoupon({ ...ship, scope: 'STORE', sellerId: 's1' }, two, 0, now)).toMatchObject({ ok: true, discount: 6_000, allocation: [6_000, 0] });
  });

  it('fails when delivery is already free', () => {
    expect(evaluateCoupon(ship, one(100_000, 0), 0, now).ok).toBe(false);
  });
});

describe('evaluateCoupon — payment vouchers', () => {
  const pay: CouponRule = { ...base, scope: 'PAYMENT', paymentMethod: 'BKASH', minOrderAmount: 0 };

  it('needs the matching payment method (unchosen counts as cash on delivery)', () => {
    const missing = evaluateCoupon(pay, one(300_000), 0, now);
    expect(!missing.ok && missing.reason).toContain('Pay with bKash');
    expect(evaluateCoupon(pay, { ...one(300_000), paymentMethod: 'SSLCOMMERZ' }, 0, now).ok).toBe(false);
    expect(evaluateCoupon(pay, { ...one(300_000), paymentMethod: 'BKASH' }, 0, now)).toMatchObject({ ok: true, discount: 30_000 });
  });
});

describe('allocateDiscount', () => {
  it('splits proportionally and preserves the total exactly', () => {
    const parts = allocateDiscount(1001, [3000, 1000, 1000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1001);
    expect(parts[0]).toBeGreaterThan(parts[1] ?? 0);
  });

  it('returns zeros when there is nothing to split', () => {
    expect(allocateDiscount(0, [100, 200])).toEqual([0, 0]);
  });
});
