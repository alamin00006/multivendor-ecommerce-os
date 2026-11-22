import { BadGatewayException, type Logger } from '@nestjs/common';
import type { CourierLocation, CourierProvider } from '@marketbd/shared';

/** Credentials as entered in Admin → Couriers, keyed by COURIER_CATALOG field keys. */
export type CourierCredentials = Record<string, string>;

/** Everything an adapter needs to call the courier for one account. */
export interface CourierContext {
  credentials: CourierCredentials;
  sandbox: boolean;
  /** Changes whenever credentials or environment change; used to cache auth tokens. */
  cacheKey: string;
}

/** What a courier update means for the package. */
export type CourierEffect = 'shipped' | 'delivered' | 'returned' | 'pickup_cancelled' | null;

export interface BookingRequest {
  /** Our unique reference (merchant order id / invoice). */
  reference: string;
  /** Courier store to collect from, for couriers with per-seller stores. */
  storeExternalId: string | null;
  recipientName: string;
  /** Local format 01XXXXXXXXX. */
  recipientPhone: string;
  recipientAddress: string;
  /** Cash to collect, whole taka. */
  codTaka: number;
  quantity: number;
  weightKg: number;
  description: string;
  instruction?: string;
}

export interface BookingResult {
  consignmentId: string;
  trackingCode: string | null;
  status: string;
  /** Delivery charge in taka when the courier quotes it at booking. */
  deliveryFeeTaka: number | null;
}

export interface CourierStatusResult {
  status: string;
  updatedAt: Date | null;
}

export interface WebhookUpdate {
  consignmentId: string;
  status: string;
  updatedAt: Date | null;
  /** Taka. */
  collectedAmount: number | null;
  /** Taka. */
  deliveryFee: number | null;
}

export interface WebhookResult {
  authorized: boolean;
  /** Parsed update; null for handshakes and events we do not act on. */
  update: WebhookUpdate | null;
  httpStatus: number;
  responseHeaders?: Record<string, string>;
}

export interface StoreRegistration {
  name: string;
  contactName: string;
  /** Local format 01XXXXXXXXX. */
  contactNumber: string;
  address: string;
  cityId: number;
  zoneId: number;
  areaId: number;
}

/**
 * One courier company. Adding a courier = implement this, register it in CourierRegistry
 * and add its entry to COURIER_CATALOG (credential fields shown in Admin → Couriers).
 */
export interface CourierAdapter {
  readonly provider: CourierProvider;
  /** Checks the credentials work; returns a short message for the admin (e.g. the balance). */
  testConnection(ctx: CourierContext): Promise<string>;
  book(ctx: CourierContext, req: BookingRequest): Promise<BookingResult>;
  status(ctx: CourierContext, consignmentId: string): Promise<CourierStatusResult>;
  effect(status: string): CourierEffect;
  /** Authenticates and parses an incoming webhook. `secret` is the account's webhook secret. */
  webhook(headers: Record<string, string | string[] | undefined>, body: unknown, secret: string): WebhookResult;

  // Per-seller pickup stores (only couriers with `supportsStores` in the catalog).
  locations?(ctx: CourierContext, kind: 'cities' | 'zones' | 'areas', parentId?: number): Promise<CourierLocation[]>;
  /** Returns the new store's id when the courier reports it straight away. */
  createStore?(ctx: CourierContext, store: StoreRegistration): Promise<string | null>;
  findStoreId?(ctx: CourierContext, name: string): Promise<string | null>;
}

/** fetch with a timeout; returns the parsed JSON body (or { message } for non-JSON) and the status. */
export async function courierFetch<T>(
  logger: Logger,
  courier: string,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: T }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    logger.error(`${url} → ${(e as Error).message}`);
    throw new BadGatewayException(`${courier} is not responding. Please try again.`);
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 200) };
  }
  return { status: res.status, body: body as T };
}

/** First validation message from { errors: { field: [msg] } }, else the message. */
export const courierErrorText = (res: { message?: unknown; errors?: unknown } | null | undefined): string => {
  const errors = res?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors as Record<string, unknown>)[0];
    const msg = Array.isArray(first) ? first[0] : first;
    if (typeof msg === 'string' && msg) return msg;
  }
  return typeof res?.message === 'string' && res.message ? res.message : 'request failed';
};

/** Constant-time string comparison. */
export { timingSafeEqualStrings } from './timing-safe.js';

export const headerValue = (headers: Record<string, string | string[] | undefined>, name: string): string | undefined => {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

export const toNumber = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export const toDate = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
