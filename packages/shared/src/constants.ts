/** Brand + platform constants. Rename the marketplace by changing BRAND only. */
export const BRAND = {
  name: 'MarketBD',
  nameBn: 'মার্কেটবিডি',
  tagline: 'Everything you need, delivered across Bangladesh',
  taglineBn: 'সারা বাংলাদেশে আপনার প্রয়োজনীয় সবকিছু',
  supportEmail: 'support@marketbd.example',
  supportPhone: '+8809600000000',
  deepLinkScheme: 'marketbd',
} as const;

export const CURRENCY = { code: 'BDT', symbol: '৳', minorUnitsPerMajor: 100 } as const;

/** Shipping fee in poisha by zone. */
export const SHIPPING_FEES = { INSIDE_DHAKA: 6_000, OUTSIDE_DHAKA: 12_000 } as const;

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 } as const;

export const AUTH = {
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  otpLength: 6,
  otpTtlSeconds: 5 * 60,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  passwordMinLength: 8,
} as const;

export const CART = { maxQuantityPerItem: 20, maxItems: 100 } as const;

export const UPLOADS = {
  maxImageBytes: 5 * 1024 * 1024,
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const,
  resizeWidths: [64, 128, 256, 384, 512, 768, 1024, 1280, 1600] as const,
} as const;

export const LOW_STOCK_THRESHOLD = 5;

/** Bangladeshi mobile number in E.164 form, e.g. +8801712345678. */
export const BD_PHONE_REGEX = /^\+8801[3-9]\d{8}$/;
