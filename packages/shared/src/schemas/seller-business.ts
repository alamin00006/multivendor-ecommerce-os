import { z } from 'zod';
import { PaginationQuerySchema } from './common.js';

// ───────── Earnings & payouts ─────────

export const PAYOUT_METHODS = ['BKASH', 'NAGAD', 'BANK'] as const;
export const PAYOUT_STATUSES = ['REQUESTED', 'PAID', 'REJECTED'] as const;
export const PayoutMethodSchema = z.enum(PAYOUT_METHODS);
export const PayoutStatusSchema = z.enum(PAYOUT_STATUSES);
export type PayoutMethod = z.infer<typeof PayoutMethodSchema>;
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

/** Smallest payout a seller can request, in poisha (৳500). */
export const MIN_PAYOUT = 50_000;

export const PayoutAccountSchema = z
  .object({
    method: PayoutMethodSchema,
    accountName: z.string().trim().min(2, 'Enter the account holder name').max(120),
    accountNumber: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^\+?\d{6,30}$/, 'Enter a valid account / wallet number')),
    bankName: z.string().trim().max(120).optional(),
    branch: z.string().trim().max(120).optional(),
  })
  .refine((a) => a.method !== 'BANK' || Boolean(a.bankName), { message: 'Enter the bank name', path: ['bankName'] });
export type PayoutAccountInput = z.input<typeof PayoutAccountSchema>;
export type PayoutAccount = z.infer<typeof PayoutAccountSchema>;

export const PayoutRequestSchema = z.object({
  /** Poisha. */
  amount: z.coerce.number().int().min(MIN_PAYOUT, 'The minimum payout is ৳500'),
  note: z.string().trim().max(300).optional(),
});
export type PayoutRequestInput = z.input<typeof PayoutRequestSchema>;

export const AdminPayoutUpdateSchema = z
  .object({
    status: z.enum(['PAID', 'REJECTED']),
    reference: z.string().trim().max(120).optional(),
    adminNote: z.string().trim().max(300).optional(),
  })
  .refine((p) => p.status !== 'PAID' || Boolean(p.reference), { message: 'Enter the transaction ID / reference', path: ['reference'] })
  .refine((p) => p.status !== 'REJECTED' || Boolean(p.adminNote), { message: 'Tell the seller why', path: ['adminNote'] });
export type AdminPayoutUpdateInput = z.input<typeof AdminPayoutUpdateSchema>;

export const PayoutListQuerySchema = PaginationQuerySchema.extend({ status: PayoutStatusSchema.optional() });
export type PayoutListQuery = z.input<typeof PayoutListQuerySchema>;

// ───────── Seller returns ─────────

export const SellerReturnUpdateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED']),
  sellerNote: z.string().trim().max(500).optional(),
});
export type SellerReturnUpdateInput = z.input<typeof SellerReturnUpdateSchema>;

// ───────── Seller reviews ─────────

export const ReviewReplySchema = z.object({
  reply: z.string().trim().min(2, 'Write a short reply').max(1000),
});
export type ReviewReplyInput = z.input<typeof ReviewReplySchema>;

export const SellerReviewQuerySchema = PaginationQuerySchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  /** "no" = still waiting for a reply. */
  replied: z.enum(['yes', 'no']).optional(),
});
export type SellerReviewQuery = z.input<typeof SellerReviewQuerySchema>;

// ───────── Reports ─────────

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const SellerReportQuerySchema = z
  .object({ from: Day, to: Day })
  .refine((q) => q.from <= q.to, { message: 'Start date must be before the end date', path: ['from'] })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 366, { message: 'Pick a range of one year or less', path: ['to'] });
export type SellerReportQuery = z.infer<typeof SellerReportQuerySchema>;

// ───────── Bulk price / stock update ─────────

export const BulkStockUpdateSchema = z.object({
  rows: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(64),
        /** Poisha. */
        price: z.number().int().min(1).optional(),
        stock: z.number().int().min(0).max(1_000_000).optional(),
      }),
    )
    .min(1, 'The file has no rows')
    .max(1000, 'Up to 1000 rows per upload'),
});
export type BulkStockUpdateInput = z.input<typeof BulkStockUpdateSchema>;
