import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of two strings of any length. */
export const timingSafeEqualStrings = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
