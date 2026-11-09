import { z } from 'zod';
import { BD_PHONE_REGEX, PAGINATION } from '../constants.js';

/** Accepts 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX and normalises to +8801XXXXXXXXX. */
export const BdPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .transform((v) => (v.startsWith('+') ? v : v.startsWith('880') ? `+${v}` : v.startsWith('0') ? `+88${v}` : v))
  .pipe(z.string().regex(BD_PHONE_REGEX, 'Enter a valid Bangladeshi mobile number'));

export const IdSchema = z.string().min(1).max(64);
export const IdParamSchema = z.object({ id: IdSchema });
export const SlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');
export const SlugParamSchema = z.object({ slug: SlugSchema });

/** Integer amount in poisha. */
export const MoneySchema = z.number().int().nonnegative();

/** ISO-8601 date-time string on the wire, Date after parsing. */
export const DateTimeSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time')
  .transform((v) => new Date(v));

export const UrlSchema = z.string().trim().url().max(2048);

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const BooleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  success: false;
  data: null;
  message: string;
  statusCode: number;
  errors?: ReadonlyArray<{ path: string; message: string }>;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export const buildPaginationMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
