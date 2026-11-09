import { type NextRequest, NextResponse } from 'next/server';

const API = `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/v1`;
const TTL_MS = 15_000;
let cached: { value: boolean; at: number } | null = null;

/** Optimistic mode check: seller pages are unreachable while the store runs in single-vendor mode. */
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

export async function proxy(request: NextRequest) {
  if (!(await multiVendorEnabled())) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/seller/:path*', '/sell', '/shop/:path*'],
};
