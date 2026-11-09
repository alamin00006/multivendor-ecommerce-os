import { canTransitionOrder, type OrderStatus } from '@marketbd/shared';

const FLOW: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** Statuses after which stock was taken out of the warehouse and must be returned on cancel. */
export const RESTOCK_ON_CANCEL_FROM: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

/** Admin override: any valid transition, or a forward jump along the main fulfilment flow. */
export const canAdminTransition = (from: OrderStatus, to: OrderStatus): boolean => {
  if (from === to) return false;
  if (canTransitionOrder(from, to)) return true;
  const a = FLOW.indexOf(from);
  const b = FLOW.indexOf(to);
  return a >= 0 && b > a;
};

/** Seller may move their sub-order forward through fulfilment or cancel before shipping. */
export const canSellerTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  canTransitionOrder(from, to) && (FLOW.includes(to) || to === 'CANCELLED');

/** Order-level status derived from its sub-orders. */
export const aggregateStatus = (statuses: readonly OrderStatus[]): OrderStatus => {
  if (statuses.length === 0) return 'PENDING';
  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return 'CANCELLED';
  if (active.includes('RETURN_REQUESTED')) return 'RETURN_REQUESTED';
  if (active.every((s) => s === 'REFUNDED')) return 'REFUNDED';
  if (active.every((s) => s === 'RETURNED' || s === 'REFUNDED')) return 'RETURNED';
  const inFlow = active.filter((s) => FLOW.includes(s));
  if (inFlow.length === 0) return active[0] ?? 'PENDING';
  return inFlow.reduce((min, s) => (FLOW.indexOf(s) < FLOW.indexOf(min) ? s : min));
};
