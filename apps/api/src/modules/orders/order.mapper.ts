import {
  CUSTOMER_CANCELLABLE_STATUSES,
  type OrderDetail,
  type OrderItemView,
  type OrderSummary,
  RETURN_WINDOW_DAYS,
  type SellerOrderView,
  type ShippingAddressSnapshot,
  type StatusEvent,
} from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { num } from '../../common/utils.js';
import { sellerSummarySelect, toSellerSummary } from '../products/product.mapper.js';

const orderItemInclude = {
  product: { select: { slug: true } },
  review: { select: { id: true } },
} satisfies Prisma.OrderItemInclude;

type OrderItemRow = Prisma.OrderItemGetPayload<{ include: typeof orderItemInclude }>;

const toItemView = (i: OrderItemRow): OrderItemView => ({
  id: i.id,
  productId: i.productId,
  productSlug: i.product.slug,
  variantId: i.variantId,
  title: i.title,
  variantLabel: i.variantLabel,
  sku: i.sku,
  imageUrl: i.imageUrl,
  unitPrice: i.unitPrice,
  quantity: i.quantity,
  lineTotal: i.lineTotal,
  reviewed: Boolean(i.review),
});

const toEvent = (h: { toStatus: StatusEvent['status']; note: string | null; createdAt: Date }): StatusEvent => ({
  status: h.toStatus,
  note: h.note,
  createdAt: h.createdAt.toISOString(),
});

export const asShippingAddress = (value: unknown): ShippingAddressSnapshot => {
  const v = (value ?? {}) as Partial<ShippingAddressSnapshot>;
  return {
    fullName: v.fullName ?? '',
    phone: v.phone ?? '',
    addressLine: v.addressLine ?? '',
    landmark: v.landmark ?? null,
    area: v.area ?? '',
    district: v.district ?? '',
    division: v.division ?? '',
  };
};

// ───── Customer / admin order views ─────

export const orderSummaryInclude = {
  items: { select: { imageUrl: true, quantity: true }, take: 4 },
  _count: { select: { items: true } },
  user: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.OrderInclude;

type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export const toOrderSummary = (o: OrderSummaryRow, withCustomer = false): OrderSummary => ({
  id: o.id,
  orderNumber: o.orderNumber,
  status: o.status,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  total: o.total,
  itemCount: o._count.items,
  previewImages: o.items.map((i) => i.imageUrl).filter((u): u is string => Boolean(u)),
  ...(withCustomer ? { customer: o.user } : {}),
  createdAt: o.createdAt.toISOString(),
});

export const orderDetailInclude = {
  ...orderSummaryInclude,
  subOrders: {
    orderBy: { createdAt: 'asc' },
    include: {
      seller: { select: sellerSummarySelect },
      items: { include: orderItemInclude },
      history: { orderBy: { createdAt: 'asc' } },
    },
  },
  history: { where: { subOrderId: null }, orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' }, include: { refunds: { orderBy: { createdAt: 'asc' } } } },
  returns: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** When the order (or its last sub-order) was delivered, if ever. */
export const deliveredAt = (o: OrderDetailRow): Date | null => {
  const events = [...o.history, ...o.subOrders.flatMap((s) => s.history)].filter((h) => h.toStatus === 'DELIVERED');
  if (events.length === 0) return null;
  return new Date(Math.max(...events.map((e) => e.createdAt.getTime())));
};

export const canReturnOrder = (o: OrderDetailRow, now = new Date()): boolean => {
  if (!o.subOrders.some((s) => s.status === 'DELIVERED')) return false;
  if (o.returns.some((r) => r.status === 'REQUESTED' || r.status === 'APPROVED')) return false;
  const at = deliveredAt(o);
  return Boolean(at && now.getTime() - at.getTime() <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
};

export const toOrderDetail = (o: OrderDetailRow, multiVendor: boolean, withCustomer = false): OrderDetail => ({
  ...toOrderSummary(o, withCustomer),
  shippingZone: o.shippingZone,
  shippingAddress: asShippingAddress(o.shippingAddress),
  subtotal: o.subtotal,
  shippingFee: o.shippingFee,
  discount: o.discount,
  couponCode: o.couponCode,
  note: o.note,
  subOrders: o.subOrders.map((s) => ({
    id: s.id,
    seller: multiVendor ? toSellerSummary(s.seller) : null,
    status: s.status,
    subtotal: s.subtotal,
    shippingFee: s.shippingFee,
    discount: s.discount,
    total: s.total,
    commissionRate: num(s.commissionRate),
    commissionAmount: s.commissionAmount,
    trackingNumber: s.trackingNumber,
    items: s.items.map(toItemView),
    history: s.history.map(toEvent),
  })),
  history: o.history.map(toEvent),
  payments: o.payments.map((p) => ({
    id: p.id,
    method: p.method,
    status: p.status,
    amount: p.amount,
    gatewayTrxId: p.gatewayTrxId,
    paidAt: p.paidAt?.toISOString() ?? null,
    refunds: p.refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  })),
  returns: o.returns.map((r) => ({
    id: r.id,
    subOrderId: r.subOrderId,
    reason: r.reason,
    imageUrls: r.imageUrls,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
  })),
  canCancel:
    CUSTOMER_CANCELLABLE_STATUSES.includes(o.status) &&
    o.subOrders.every((s) => CUSTOMER_CANCELLABLE_STATUSES.includes(s.status) || s.status === 'CANCELLED'),
  canReturn: canReturnOrder(o),
  canPay:
    o.paymentMethod !== 'COD' &&
    o.status === 'PENDING' &&
    (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PENDING' || o.paymentStatus === 'FAILED'),
});

// ───── Seller views ─────

export const sellerOrderInclude = {
  order: {
    select: { id: true, orderNumber: true, paymentMethod: true, paymentStatus: true, shippingAddress: true },
  },
  items: { include: orderItemInclude },
  history: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SubOrderInclude;

type SellerOrderRow = Prisma.SubOrderGetPayload<{ include: typeof sellerOrderInclude }>;

export const toSellerOrderView = (s: SellerOrderRow): SellerOrderView => ({
  id: s.id,
  orderId: s.order.id,
  orderNumber: s.order.orderNumber,
  status: s.status,
  paymentMethod: s.order.paymentMethod,
  paymentStatus: s.order.paymentStatus,
  subtotal: s.subtotal,
  shippingFee: s.shippingFee,
  total: s.total,
  commissionAmount: s.commissionAmount,
  trackingNumber: s.trackingNumber,
  shippingAddress: asShippingAddress(s.order.shippingAddress),
  items: s.items.map(toItemView),
  history: s.history.map(toEvent),
  createdAt: s.createdAt.toISOString(),
});
