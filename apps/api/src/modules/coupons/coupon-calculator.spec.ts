import { describe, expect, it } from 'vitest';
import { allocateDiscount, type CouponRule, evaluateCoupon } from './coupon-calculator.js';

const now = new Date('2026-06-01T00:00:00Z');
const base: CouponRule = {
  code: 'SAVE10',
  type: 'PERCENTAGE',
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

describe('evaluateCoupon', () => {
  it('applies a percentage discount', () => {
    expect(evaluateCoupon(base, 300_000, 0, now)).toEqual({ ok: true, discount: 30_000 });
  });

  it('caps percentage discounts at maxDiscount', () => {
    expect(evaluateCoupon(base, 1_000_000, 0, now)).toEqual({ ok: true, discount: 50_000 });
  });

  it('applies a fixed discount but never more than the subtotal', () => {
    const fixed = { ...base, type: 'FIXED' as const, value: 500_000, minOrderAmount: 0, maxDiscount: null };
    expect(evaluateCoupon(fixed, 300_000, 0, now)).toEqual({ ok: true, discount: 300_000 });
  });

  it('enforces the minimum order amount', () => {
    const result = evaluateCoupon(base, 100_000, 0, now);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('Minimum order');
  });

  it('rejects expired, inactive, exhausted and already-used coupons', () => {
    expect(evaluateCoupon({ ...base, endsAt: new Date('2026-05-01') }, 300_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, isActive: false }, 300_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, usedCount: 100 }, 300_000, 0, now).ok).toBe(false);
    expect(evaluateCoupon(base, 300_000, 1, now).ok).toBe(false);
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
