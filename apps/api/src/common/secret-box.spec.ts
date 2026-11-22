import { describe, expect, it } from 'vitest';
import { openJson, sealJson } from './secret-box.js';

describe('secret box', () => {
  it('round-trips JSON and hides the plaintext', () => {
    const sealed = sealJson({ apiKey: 'abc', secretKey: 's3cr3t' });
    expect(sealed).not.toContain('s3cr3t');
    expect(openJson(sealed)).toEqual({ apiKey: 'abc', secretKey: 's3cr3t' });
    expect(sealJson({ a: 1 })).not.toBe(sealJson({ a: 1 })); // random IV
  });

  it('rejects tampered data', () => {
    const [iv, tag, data] = sealJson({ a: 1 }).split('.');
    const flipped = Buffer.from(data!, 'base64url');
    flipped[0] = flipped[0]! ^ 1;
    expect(() => openJson(`${iv}.${tag}.${flipped.toString('base64url')}`)).toThrow();
  });
});
