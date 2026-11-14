import type { ImageLoaderProps } from 'next/image';

/** Routes images through the API resize endpoint (WebP, cached for a year). */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  const params = new URLSearchParams({ url: src, width: String(width), quality: String(quality ?? 75) });
  return `/api/v1/images/resize?${params.toString()}`;
}
