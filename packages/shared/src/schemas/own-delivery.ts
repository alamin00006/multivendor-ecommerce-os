import { z } from 'zod';

/** Couriers a shop can deliver with on its own account (or its own riders). */
export const OWN_COURIERS = ['PATHAO', 'STEADFAST', 'REDX', 'PAPERFLY', 'SUNDARBAN', 'ECOURIER', 'OWN_RIDER', 'OTHER'] as const;
export type OwnCourier = (typeof OWN_COURIERS)[number];
export const OWN_COURIER_LABEL: Record<OwnCourier, string> = {
  PATHAO: 'Pathao',
  STEADFAST: 'Steadfast',
  REDX: 'RedX',
  PAPERFLY: 'Paperfly',
  SUNDARBAN: 'Sundarban Courier',
  ECOURIER: 'eCourier',
  OWN_RIDER: 'Own delivery rider',
  OTHER: 'Other courier',
};

/** Shop's own-courier settings. Fees are in poisha. */
export const OwnDeliverySchema = z
  .object({
    courier: z.enum(OWN_COURIERS),
    courierName: z.string().trim().max(60).optional(),
    insideDhakaFee: z.coerce.number().int().min(0).max(100_000),
    outsideDhakaFee: z.coerce.number().int().min(0).max(100_000),
    insideDhakaEta: z.string().trim().min(2, 'Say how long delivery takes, e.g. 1–2 days').max(40),
    outsideDhakaEta: z.string().trim().min(2, 'Say how long delivery takes, e.g. 3–5 days').max(40),
  })
  .refine((d) => d.courier !== 'OTHER' || Boolean(d.courierName), { message: 'Enter the courier name', path: ['courierName'] });
export type OwnDeliveryInput = z.input<typeof OwnDeliverySchema>;
export type OwnDeliveryPayload = z.infer<typeof OwnDeliverySchema>;

/** Display name of a shop's courier. */
export const ownCourierName = (d: { courier: OwnCourier; courierName?: string | null }) =>
  d.courier === 'OTHER' && d.courierName ? d.courierName : OWN_COURIER_LABEL[d.courier];

export const OwnDeliveryDecisionSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'DISABLE']),
    note: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.action === 'APPROVE' || Boolean(d.note), { message: 'Tell the seller why', path: ['note'] });
export type OwnDeliveryDecisionInput = z.input<typeof OwnDeliveryDecisionSchema>;

/** Admin records money received from a seller (positive) or a correction (negative). Poisha. */
export const SellerAdjustmentSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, 'Enter an amount')
    .refine((v) => Math.abs(v) <= 100_000_000, 'Amount is too large'),
  note: z.string().trim().min(3, 'Add a short note, e.g. "Commission paid via bKash"').max(200),
  reference: z.string().trim().max(80).optional(),
});
export type SellerAdjustmentInput = z.input<typeof SellerAdjustmentSchema>;

/** Customer: "I did not receive this package". */
export const DeliveryDisputeSchema = z.object({
  note: z.string().trim().min(5, 'Tell us what happened').max(500),
});
export type DeliveryDisputeInput = z.input<typeof DeliveryDisputeSchema>;

export const ResolveDisputeSchema = z.object({
  resolution: z.enum(['DELIVERED', 'NOT_DELIVERED']),
  note: z.string().trim().max(300).optional(),
});
export type ResolveDisputeInput = z.input<typeof ResolveDisputeSchema>;
