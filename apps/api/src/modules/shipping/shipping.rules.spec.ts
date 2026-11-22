import { describe, expect, it } from 'vitest';
import { courierPath } from '../order-status/order-status.rules.js';
import { PathaoAdapter } from './couriers/pathao.adapter.js';
import { SteadfastAdapter } from './couriers/steadfast.adapter.js';
import { merchantOrderId, toCourierTaka, toLocalPhone } from './shipping.rules.js';

describe('Pathao status mapping', () => {
  const pathao = new PathaoAdapter();
  it('reads webhook events and order statuses alike', () => {
    expect(pathao.effect('order.picked')).toBe('shipped');
    expect(pathao.effect('In Transit')).toBe('shipped');
    expect(pathao.effect('order.at-the-sorting-hub')).toBe('shipped');
    expect(pathao.effect('Delivered')).toBe('delivered');
    expect(pathao.effect('order.partial-delivery')).toBe('delivered');
    expect(pathao.effect('order.returned')).toBe('returned');
    expect(pathao.effect('Pickup_Cancelled')).toBe('pickup_cancelled');
  });

  it('ignores early and unknown stages', () => {
    for (const s of ['order.created', 'Pending', 'order.pickup-requested', 'order.pickup-failed', 'something-new']) {
      expect(pathao.effect(s)).toBeNull();
    }
  });
});

describe('Steadfast status mapping', () => {
  const steadfast = new SteadfastAdapter();
  it('treats approval-pending deliveries as delivered and cancellations as returns', () => {
    expect(steadfast.effect('delivered')).toBe('delivered');
    expect(steadfast.effect('partial_delivered_approval_pending')).toBe('delivered');
    expect(steadfast.effect('cancelled')).toBe('returned');
    expect(steadfast.effect('in_review')).toBeNull();
    expect(steadfast.effect('pending')).toBeNull();
    expect(steadfast.effect('hold')).toBeNull();
  });

  it('authenticates webhooks with the bearer token', () => {
    const body = { notification_type: 'delivery_status', consignment_id: 5, status: 'delivered', cod_amount: 1500, delivery_charge: 60 };
    expect(steadfast.webhook({}, body, 'sec').authorized).toBe(false);
    expect(steadfast.webhook({ authorization: 'Bearer nope' }, body, 'sec').authorized).toBe(false);
    expect(steadfast.webhook({ authorization: 'Bearer sec' }, body, 'sec').update).toMatchObject({ consignmentId: '5', status: 'delivered', collectedAmount: 1500, deliveryFee: 60 });
    expect(steadfast.webhook({ authorization: 'Bearer sec' }, { notification_type: 'tracking_update', consignment_id: 5 }, 'sec').update).toBeNull();
  });
});

describe('courierPath', () => {
  it('walks forward one status at a time', () => {
    expect(courierPath('CONFIRMED', 'DELIVERED')).toEqual(['PROCESSING', 'SHIPPED', 'DELIVERED']);
    expect(courierPath('SHIPPED', 'DELIVERED')).toEqual(['DELIVERED']);
    expect(courierPath('DELIVERED', 'SHIPPED')).toEqual([]);
    expect(courierPath('PENDING', 'SHIPPED')).toEqual([]);
  });

  it('cancels a returned parcel only before delivery', () => {
    expect(courierPath('SHIPPED', 'CANCELLED')).toEqual(['CANCELLED']);
    expect(courierPath('DELIVERED', 'CANCELLED')).toEqual([]);
  });
});

describe('helpers', () => {
  it('formats money, phones and references for couriers', () => {
    expect(toCourierTaka(125_050)).toBe(1251);
    expect(toLocalPhone('+8801712345678')).toBe('01712345678');
    expect(toLocalPhone('01712345678')).toBe('01712345678');
    expect(merchantOrderId('MB-1001', 'ckabcd1234wxyz', 1)).toBe('MB-1001-WXYZ');
    expect(merchantOrderId('MB-1001', 'ckabcd1234wxyz', 2)).toBe('MB-1001-WXYZ-2');
  });
});
