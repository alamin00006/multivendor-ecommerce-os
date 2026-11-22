import { fromPoisha } from '@marketbd/shared';

/** Couriers take whole taka. */
export const toCourierTaka = (poisha: number): number => Math.round(fromPoisha(poisha));

/** Couriers expect 01XXXXXXXXX; our snapshots store +8801XXXXXXXXX. */
export const toLocalPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('880') ? digits.slice(2) : digits;
};

/** Unique reference per booking: order number + package code, with a suffix when rebooked. */
export const merchantOrderId = (orderNumber: string, subOrderId: string, attempt: number): string =>
  `${orderNumber}-${subOrderId.slice(-4).toUpperCase()}${attempt > 1 ? `-${attempt}` : ''}`;
