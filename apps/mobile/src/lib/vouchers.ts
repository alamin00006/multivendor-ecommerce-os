import { BRAND } from '@marketbd/shared';
import type { CouponView, PaymentMethod } from '@marketbd/shared';

const METHOD: Record<PaymentMethod, string> = { COD: 'Cash on Delivery', BKASH: 'bKash', SSLCOMMERZ: 'Card & mobile banking', CASH: 'Cash' };

/** "Free Delivery", "Storewide · Gadget Ghor", "Payment · bKash" or "MarketBD Voucher". */
export const voucherKind = (v: CouponView) =>
  v.type === 'FREE_SHIPPING'
    ? v.scope === 'STORE' && v.seller
      ? `Free Delivery · ${v.seller.shopName}`
      : 'Free Delivery'
    : v.scope === 'STORE'
      ? `Storewide · ${v.seller?.shopName ?? 'Shop'}`
      : v.scope === 'PAYMENT' && v.paymentMethod
        ? `Payment · ${METHOD[v.paymentMethod]}`
        : `${BRAND.name} Voucher`;

/** "10% off", "৳50 off", "Free delivery" or "৳60 off delivery". */
export const voucherAmount = (v: CouponView, money: (poisha: number) => string) =>
  v.type === 'FREE_SHIPPING'
    ? v.value > 0
      ? `${money(v.value)} off delivery`
      : 'Free delivery'
    : v.type === 'PERCENTAGE'
      ? `${v.value}% off`
      : `${money(v.value)} off`;

export const paymentMethodName = (m: PaymentMethod) => METHOD[m];
