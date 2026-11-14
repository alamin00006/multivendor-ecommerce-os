'use client';

import type { OrderStatus, PaymentStatus } from '@marketbd/shared';
import { useI18n } from './i18n';
import { Badge } from './primitives';

const ORDER_TONE: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'primary',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURN_REQUESTED: 'warning',
  RETURNED: 'neutral',
  REFUNDED: 'neutral',
};

const PAY_TONE: Record<PaymentStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  UNPAID: 'neutral',
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return <Badge tone={ORDER_TONE[status]}>{t.status[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();
  return <Badge tone={PAY_TONE[status]}>{t.payStatus[status]}</Badge>;
}
