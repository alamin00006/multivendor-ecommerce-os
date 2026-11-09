import 'server-only';
import type { ApiResponse, PaginationMeta } from '@marketbd/shared';

const API = `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1`;

export class ApiNotFoundError extends Error {}

interface Options {
  /** Seconds to cache the response (ISR). 0 = always fresh. */
  revalidate?: number;
  tags?: string[];
}

/** Server-side GET against the API. Returns null on 404, throws on other failures. */
export async function apiGet<T>(path: string, { revalidate = 60, tags }: Options = {}): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    next: { revalidate, tags },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  const body = (await res.json()) as ApiResponse<T>;
  return body.data;
}

export async function apiGetPage<T>(path: string, options: Options = {}): Promise<{ items: T[]; meta: PaginationMeta } | null> {
  const res = await fetch(`${API}${path}`, {
    next: { revalidate: options.revalidate ?? 60, tags: options.tags },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  const body = (await res.json()) as ApiResponse<T[]>;
  return { items: body.data, meta: body.meta ?? { page: 1, limit: body.data.length, total: body.data.length, totalPages: 1 } };
}

/** Never throws — for optional page sections that should degrade gracefully. */
export async function apiTry<T>(path: string, options: Options = {}): Promise<T | null> {
  try {
    return await apiGet<T>(path, options);
  } catch {
    return null;
  }
}

/** Marketplace mode at server render (short cache so admin toggles show up quickly). */
export async function getMultiVendor(): Promise<boolean> {
  const settings = await apiTry<{ multiVendorEnabled: boolean }>('/settings/public', { revalidate: 15, tags: ['settings'] });
  return settings?.multiVendorEnabled ?? true;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
