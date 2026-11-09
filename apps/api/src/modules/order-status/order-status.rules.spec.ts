import { describe, expect, it } from 'vitest';
import { aggregateStatus, canAdminTransition, canSellerTransition } from './order-status.rules.js';

describe('order status rules', () => {
  it('lets sellers move forward one step and cancel before shipping', () => {
    expect(canSellerTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canSellerTransition('PROCESSING', 'CANCELLED')).toBe(true);
    expect(canSellerTransition('CONFIRMED', 'DELIVERED')).toBe(false);
    expect(canSellerTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canSellerTransition('CANCELLED', 'REFUNDED')).toBe(false);
  });

  it('lets admins jump forward but never backwards', () => {
    expect(canAdminTransition('PENDING', 'DELIVERED')).toBe(true);
    expect(canAdminTransition('CANCELLED', 'REFUNDED')).toBe(true);
    expect(canAdminTransition('DELIVERED', 'PENDING')).toBe(false);
    expect(canAdminTransition('SHIPPED', 'SHIPPED')).toBe(false);
  });

  it('derives the order status from sub-orders', () => {
    expect(aggregateStatus(['SHIPPED', 'CONFIRMED'])).toBe('CONFIRMED');
    expect(aggregateStatus(['CANCELLED', 'DELIVERED'])).toBe('DELIVERED');
    expect(aggregateStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
    expect(aggregateStatus(['DELIVERED', 'RETURN_REQUESTED'])).toBe('RETURN_REQUESTED');
    expect(aggregateStatus(['RETURNED', 'REFUNDED'])).toBe('RETURNED');
    expect(aggregateStatus(['REFUNDED'])).toBe('REFUNDED');
  });
});
