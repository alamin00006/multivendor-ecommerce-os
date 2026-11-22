import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const key = (): Buffer =>
  createHash('sha256')
    .update(env.DATA_ENCRYPTION_KEY || `dev-only:${env.JWT_REFRESH_SECRET}`)
    .digest();

/** Encrypts a JSON value with AES-256-GCM. Output: base64url "iv.tag.ciphertext". */
export const sealJson = (value: unknown): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
};

/** Decrypts a value from sealJson. Throws if it was tampered with or the key changed. */
export const openJson = <T>(sealed: string): T => {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed sealed value');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')) as T;
};
