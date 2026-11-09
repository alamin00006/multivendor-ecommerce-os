import { z } from 'zod';

export const ROLES = ['CUSTOMER', 'SELLER', 'ADMIN'] as const;
export const SELLER_STATUSES = ['PENDING', 'APPROVED', 'SUSPENDED'] as const;
export const PRODUCT_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'REJECTED'] as const;
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
] as const;
export const PAYMENT_METHODS = ['COD', 'BKASH', 'SSLCOMMERZ'] as const;
export const PAYMENT_STATUSES = ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;
export const SHIPPING_ZONES = ['INSIDE_DHAKA', 'OUTSIDE_DHAKA'] as const;
export const COUPON_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export const CAMPAIGN_TYPES = ['MEGA_SALE', 'BRAND_DAY', 'CATEGORY_SALE', 'SEASONAL'] as const;
export const LINK_TARGET_TYPES = ['CATEGORY', 'CAMPAIGN', 'PRODUCT', 'BRAND', 'SEARCH', 'EXTERNAL'] as const;
export const BANNER_PLACEMENTS = ['HOME_HERO', 'HOME_MID', 'CATEGORY_TOP'] as const;
export const OTP_PURPOSES = ['LOGIN', 'VERIFY_PHONE', 'RESET_PASSWORD'] as const;
export const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED'] as const;
export const REFUND_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export const NOTIFICATION_TYPES = ['ORDER', 'PAYMENT', 'PROMO', 'SYSTEM', 'SELLER'] as const;
export const LOCALES = ['EN', 'BN'] as const;
export const ADDRESS_LABELS = ['HOME', 'OFFICE', 'OTHER'] as const;

export const RoleSchema = z.enum(ROLES);
export const SellerStatusSchema = z.enum(SELLER_STATUSES);
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const ShippingZoneSchema = z.enum(SHIPPING_ZONES);
export const CouponTypeSchema = z.enum(COUPON_TYPES);
export const CampaignTypeSchema = z.enum(CAMPAIGN_TYPES);
export const LinkTargetTypeSchema = z.enum(LINK_TARGET_TYPES);
export const BannerPlacementSchema = z.enum(BANNER_PLACEMENTS);
export const OtpPurposeSchema = z.enum(OTP_PURPOSES);
export const ReturnStatusSchema = z.enum(RETURN_STATUSES);
export const RefundStatusSchema = z.enum(REFUND_STATUSES);
export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const LocaleSchema = z.enum(LOCALES);
export const AddressLabelSchema = z.enum(ADDRESS_LABELS);

export type Role = z.infer<typeof RoleSchema>;
export type SellerStatus = z.infer<typeof SellerStatusSchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type ShippingZone = z.infer<typeof ShippingZoneSchema>;
export type CouponType = z.infer<typeof CouponTypeSchema>;
export type CampaignType = z.infer<typeof CampaignTypeSchema>;
export type LinkTargetType = z.infer<typeof LinkTargetTypeSchema>;
export type BannerPlacement = z.infer<typeof BannerPlacementSchema>;
export type OtpPurpose = z.infer<typeof OtpPurposeSchema>;
export type ReturnStatus = z.infer<typeof ReturnStatusSchema>;
export type RefundStatus = z.infer<typeof RefundStatusSchema>;
export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
export type AddressLabel = z.infer<typeof AddressLabelSchema>;

/** Allowed order status transitions — enforced by the API's order state machine. */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: ['REFUNDED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

/** Statuses from which a customer may cancel their own order. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ['PENDING', 'CONFIRMED'];

/** Days after delivery during which a return can be requested. */
export const RETURN_WINDOW_DAYS = 7;

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[from].includes(to);
