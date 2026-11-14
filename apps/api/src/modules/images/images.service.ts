import { BadGatewayException, BadRequestException, GatewayTimeoutException, Injectable } from '@nestjs/common';
import { UPLOADS } from '@marketbd/shared';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { env } from '../../config/env.js';

export interface ResizedImage {
  body: Buffer;
  contentType: string;
  etag: string;
}

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const CACHE_ENTRIES = 300;
const CACHE_MAX_BYTES = 80 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 6_000;
const FAILURE_TTL_MS = 60_000;

/** Snaps a requested width to the nearest allowed size so the cache stays small. */
export const snapWidth = (width: number): number =>
  UPLOADS.resizeWidths.find((w) => w >= width) ?? UPLOADS.resizeWidths[UPLOADS.resizeWidths.length - 1] ?? width;

/** Fetches allow-listed remote images, resizes them with sharp and keeps a small in-memory LRU. */
@Injectable()
export class ImagesService {
  private readonly cache = new Map<string, ResizedImage>();
  private cacheBytes = 0;
  /** Source host → time until which it is treated as unavailable (simple circuit breaker). */
  private readonly failures = new Map<string, number>();

  private markFailed(host: string): void {
    this.failures.set(host, Date.now() + FAILURE_TTL_MS);
    if (this.failures.size > 2000) {
      const now = Date.now();
      for (const [key, until] of this.failures) if (until <= now) this.failures.delete(key);
    }
  }

  private assertAllowed(raw: string): URL {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('Invalid image URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadRequestException('Invalid image URL');
    const storageHost = new URL(env.S3_PUBLIC_URL).host;
    const allowed = new Set([storageHost, ...env.IMAGE_ALLOWED_HOSTS]);
    if (!allowed.has(url.host)) throw new BadRequestException('Image host is not allowed');
    return url;
  }

  private remember(key: string, value: ResizedImage): void {
    this.cache.set(key, value);
    this.cacheBytes += value.body.length;
    while (this.cache.size > CACHE_ENTRIES || this.cacheBytes > CACHE_MAX_BYTES) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cacheBytes -= this.cache.get(oldest)?.body.length ?? 0;
      this.cache.delete(oldest);
    }
  }

  async resize(
    rawUrl: string,
    width: number,
    quality: number,
    format: 'webp' | 'avif' | 'jpeg',
  ): Promise<ResizedImage> {
    const url = this.assertAllowed(rawUrl);
    const w = snapWidth(width);
    const key = `${url.href}|${w}|${quality}|${format}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }

    // A host that just failed fails fast for a minute, so a dead image host cannot tie up
    // the browser's connections (and block page data) with one slow request per image.
    const failedUntil = this.failures.get(url.host);
    if (failedUntil && failedUntil > Date.now()) {
      throw new GatewayTimeoutException('The source image is currently unavailable');
    }

    let res: Response;
    try {
      res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
    } catch (error) {
      this.markFailed(url.host);
      // Source host unreachable or too slow — a gateway problem, not a server bug.
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('The source image took too long to respond');
      }
      throw new BadGatewayException('Could not reach the source image host');
    }
    if (!res.ok) {
      this.markFailed(url.host);
      throw new BadGatewayException('Could not fetch the source image');
    }
    this.failures.delete(url.host);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_SOURCE_BYTES) throw new BadRequestException('Source image is too large');
    const source = Buffer.from(await res.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) throw new BadRequestException('Source image is too large');

    let pipeline = sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: w, withoutEnlargement: true });
    pipeline =
      format === 'avif'
        ? pipeline.avif({ quality })
        : format === 'jpeg'
          ? pipeline.jpeg({ quality, mozjpeg: true })
          : pipeline.webp({ quality });
    let body: Buffer;
    try {
      body = await pipeline.toBuffer();
    } catch {
      throw new BadRequestException('The source is not a valid image');
    }
    const result: ResizedImage = {
      body,
      contentType: `image/${format}`,
      etag: `"${createHash('sha1').update(body).digest('hex')}"`,
    };
    this.remember(key, result);
    return result;
  }
}
