import { z } from 'zod';
import { CART } from '../constants.js';
import {
  CouponTypeSchema,
  OrderStatusSchema,
  PaymentMethodSchema,
  PaymentStatusSchema,
  ReturnStatusSchema,
} from '../enums.js';
import { DateTimeSchema, MoneySchema, PaginationQuerySchema, UrlSchema } from './common.js';

// ───────── Cart ─────────

export const AddToCartSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(CART.maxQuantityPerItem).default(1),
});
export type AddToCartInput = z.input<typeof AddToCartSchema>;
export type AddToCartPayload = z.infer<typeof AddToCartSchema>;

export const UpdateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(CART.maxQuantityPerItem).optional(),
  selected: z.boolean().optional(),
});
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

export const MergeCartSchema = z.object({
  items: z.array(AddToCartSchema).max(CART.maxItems),
});
export type MergeCartInput = z.input<typeof MergeCartSchema>;
export type MergeCartPayload = z.infer<typeof MergeCartSchema>;

export const SelectAllCartSchema = z.object({ selected: z.boolean() });

// ───────── Coupons ─────────

export const CouponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9_-]+$/, 'Invalid coupon code');

export const ApplyCouponSchema = z.object({ code: CouponCodeSchema });
export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;

export const CouponSchema = z
  .object({
    code: CouponCodeSchema,
    description: z.string().trim().max(200).optional(),
    type: CouponTypeSchema,
    value: z.coerce.number().int().positive(),
    minOrderAmount: MoneySchema.default(0),
    maxDiscount: MoneySchema.nullable().optional(),
    usageLimit: z.coerce.number().int().positive().nullable().optional(),
    perUserLimit: z.coerce.number().int().positive().default(1),
    startsAt: DateTimeSchema,
    endsAt: DateTimeSchema,
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.endsAt > c.startsAt, { message: 'End must be after start', path: ['endsAt'] })
  .refine((c) => c.type !== 'PERCENTAGE' || c.value <= 100, { message: 'Percentage must be 1–100', path: ['value'] });
export type CouponInput = z.input<typeof CouponSchema>;
export type CouponPayload = z.infer<typeof CouponSchema>;

// ───────── Checkout & orders ─────────

/** Where the customer returns after an online payment. */
export const PaymentClientSchema = z.enum(['web', 'mobile']);
export type PaymentClient = z.infer<typeof PaymentClientSchema>;

export const CheckoutSchema = z.object({
  addressId: z.string().min(1, 'Select a delivery address'),
  paymentMethod: PaymentMethodSchema,
  client: PaymentClientSchema.default('web'),
  couponCode: CouponCodeSchema.optional(),
  note: z.string().trim().max(500).optional(),
});
export type CheckoutInput = z.input<typeof CheckoutSchema>;
export type CheckoutPayload = z.infer<typeof CheckoutSchema>;

export const CheckoutPreviewSchema = z.object({
  addressId: z.string().min(1).optional(),
  couponCode: CouponCodeSchema.optional(),
});
export type CheckoutPreviewInput = z.infer<typeof CheckoutPreviewSchema>;

export const OrderListQuerySchema = PaginationQuerySchema.extend({
  status: OrderStatusSchema.optional(),
  q: z.string().trim().max(60).optional(),
  paymentStatus: PaymentStatusSchema.optional(),
});
export type OrderListQuery = z.input<typeof OrderListQuerySchema>;

export const CancelOrderSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

export const ReturnRequestSchema = z.object({
  reason: z.string().trim().min(10, 'Please describe the problem').max(1000),
  subOrderId: z.string().min(1).optional(),
  imageUrls: z.array(UrlSchema).max(5).default([]),
});
export type ReturnRequestInput = z.input<typeof ReturnRequestSchema>;
export type ReturnRequestPayload = z.infer<typeof ReturnRequestSchema>;

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusSchema,
  note: z.string().trim().max(300).optional(),
  trackingNumber: z.string().trim().max(64).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

export const UpdateReturnSchema = z.object({
  status: ReturnStatusSchema,
  adminNote: z.string().trim().max(500).optional(),
});
export type UpdateReturnInput = z.infer<typeof UpdateReturnSchema>;

export const RefundSchema = z.object({
  amount: MoneySchema.min(1),
  reason: z.string().trim().min(3).max(300),
});
export type RefundInput = z.infer<typeof RefundSchema>;

// ───────── Payments ─────────

export const InitiatePaymentSchema = z.object({
  orderId: z.string().min(1),
  client: PaymentClientSchema.default('web'),
});
export type InitiatePaymentInput = z.input<typeof InitiatePaymentSchema>;
export type InitiatePaymentPayload = z.infer<typeof InitiatePaymentSchema>;

// ───────── Reviews ─────────

export const ReviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  imageUrls: z.array(UrlSchema).max(5).default([]),
});
export type ReviewInput = z.input<typeof ReviewSchema>;
export type ReviewPayload = z.infer<typeof ReviewSchema>;

export const ReviewListQuerySchema = PaginationQuerySchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  withImages: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});
export type ReviewListQuery = z.input<typeof ReviewListQuerySchema>;

export const ModerateReviewSchema = z.object({ isVisible: z.boolean() });
