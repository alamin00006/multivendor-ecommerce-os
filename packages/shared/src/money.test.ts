import { describe, expect, it } from 'vitest';
import { discountPercent, formatBDT, toPoisha } from './money.js';
import { BdPhoneSchema } from './schemas/common.js';
import { AREAS, DISTRICTS, DIVISIONS } from './geo/index.js';
import { canTransitionOrder } from './enums.js';

describe('money', () => {
  it('formats poisha as BDT', () => {
    expect(formatBDT(125_000)).toBe('৳1,250');
    expect(formatBDT(125_050)).toBe('৳1,250.50');
    expect(formatBDT(125_000, { locale: 'bn' })).toBe('৳১,২৫০');
  });
  it('converts taka to poisha', () => {
    expect(toPoisha(12.5)).toBe(1250);
  });
  it('computes discount percent', () => {
    expect(discountPercent(750, 1000)).toBe(25);
    expect(discountPercent(1000, null)).toBe(0);
  });
});

describe('phone', () => {
  it('normalises BD numbers', () => {
    expect(BdPhoneSchema.parse('01712-345678')).toBe('+8801712345678');
    expect(BdPhoneSchema.parse('8801812345678')).toBe('+8801812345678');
    expect(BdPhoneSchema.safeParse('01212345678').success).toBe(false);
  });
});

describe('geo', () => {
  it('has the full division and district lists', () => {
    expect(DIVISIONS).toHaveLength(8);
    expect(DISTRICTS).toHaveLength(64);
    expect(new Set(DISTRICTS.map((d) => d.id)).size).toBe(64);
    expect(AREAS.every((a) => DISTRICTS.some((d) => d.id === a.districtId))).toBe(true);
  });
});

describe('order transitions', () => {
  it('allows only valid moves', () => {
    expect(canTransitionOrder('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransitionOrder('DELIVERED', 'PENDING')).toBe(false);
  });
});
