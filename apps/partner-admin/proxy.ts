import { NextResponse } from 'next/server';

const API = `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1`;
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? 'http://localhost:3100';
const TTL_MS = 15_000;
let cached: { value: boolean; at: number } | null = null;

/** Optimistic mode check: the whole Seller Center is unreachable while the store runs in single-vendor mode. */
async function multiVendorEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const res = await fetch(`${API}/settings/public`, { signal: AbortSignal.timeout(2000) });
    const body = (await res.json()) as { data?: { multiVendorEnabled?: boolean } };
    const value = body.data?.multiVendorEnabled ?? true;
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return cached?.value ?? true;
  }
}

export async function proxy() {
  if (!(await multiVendorEnabled())) return NextResponse.redirect(STORE_URL);
  return NextResponse.next();
}

export const config = {
  // Everything except the API rewrite, Next internals and static files.
  matcher: ['/((?!api/|_next/|brand/|favicon.ico).*)'],
};
