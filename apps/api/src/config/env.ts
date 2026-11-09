import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: csv,
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OTP_PROVIDER: z.enum(['console', 'sms']).default('console'),
  SMS_GATEWAY_URL: z.string().default(''),
  SMS_GATEWAY_API_KEY: z.string().default(''),
  SMS_SENDER_ID: z.string().default('MarketBD'),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool,
  S3_PUBLIC_URL: z.string().url(),
  IMAGE_ALLOWED_HOSTS: csv,

  WEB_URL: z.string().url().default('http://localhost:3000'),

  BKASH_ENABLED: bool,
  BKASH_BASE_URL: z.string().default('https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
  BKASH_APP_KEY: z.string().default(''),
  BKASH_APP_SECRET: z.string().default(''),
  BKASH_USERNAME: z.string().default(''),
  BKASH_PASSWORD: z.string().default(''),

  SSLCOMMERZ_ENABLED: bool,
  SSLCOMMERZ_BASE_URL: z.string().default('https://sandbox.sslcommerz.com'),
  SSLCOMMERZ_STORE_ID: z.string().default(''),
  SSLCOMMERZ_STORE_PASSWORD: z.string().default(''),

  OBSERVE_APP_KEY: z.string().default(''),
  OBSERVE_APP_SECRET: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env: Env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
