import { z } from 'zod';
import { AUTH } from '../constants.js';
import { GenderSchema, LocaleSchema } from '../enums.js';
import { BdPhoneSchema } from './common.js';

export const EmailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const PasswordSchema = z
  .string()
  .min(AUTH.passwordMinLength, `Password must be at least ${AUTH.passwordMinLength} characters`)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const NameSchema = z.string().trim().min(2, 'Name is too short').max(80);

export const RegisterSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  phone: BdPhoneSchema.optional(),
  password: PasswordSchema,
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const OtpRequestSchema = z.object({ phone: BdPhoneSchema });
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;

export const OtpVerifySchema = z.object({
  phone: BdPhoneSchema,
  code: z.string().trim().regex(new RegExp(`^\\d{${AUTH.otpLength}}$`), `Enter the ${AUTH.otpLength}-digit code`),
  name: NameSchema.optional(),
});
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(20).max(512).optional() });
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/** Calendar date as YYYY-MM-DD; must be a real past date for someone at least 13 years old. */
export const BirthdaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, 'Enter a valid date')
  .refine((v) => v >= '1900-01-01', 'Enter a valid date')
  .refine((v) => {
    const limit = new Date();
    limit.setUTCFullYear(limit.getUTCFullYear() - 13);
    return v <= limit.toISOString().slice(0, 10);
  }, 'You must be at least 13 years old');

export const UpdateProfileSchema = z.object({
  name: NameSchema.optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  locale: LocaleSchema.optional(),
  birthday: BirthdaySchema.nullable().optional(),
  gender: GenderSchema.nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
