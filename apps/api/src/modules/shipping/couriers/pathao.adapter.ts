import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { CourierLocation } from '@marketbd/shared';
import { env } from '../../../config/env.js';
import {
  type BookingRequest,
  type BookingResult,
  type CourierAdapter,
  type CourierContext,
  type CourierEffect,
  courierErrorText,
  courierFetch,
  type CourierStatusResult,
  headerValue,
  type StoreRegistration,
  timingSafeEqualStrings,
  toDate,
  toNumber,
  type WebhookResult,
} from './courier.adapter.js';

/** Pathao wraps every response as { code, message, data, errors? }. */
interface Envelope<T> {
  code?: number;
  message?: string;
  data?: T;
  errors?: unknown;
}

interface Paged<T> {
  data?: T[];
  last_page?: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  message?: string;
}

const SHIPPED = new Set(['picked', 'in-transit', 'at-the-sorting-hub', 'received-at-last-mile-hub', 'assigned-for-delivery', 'delivery-failed', 'on-hold', 'hold']);
const DELIVERED = new Set(['delivered', 'partial-delivery', 'partial-delivered', 'exchanged', 'exchange', 'paid']);
const RETURNED = new Set(['returned', 'return', 'paid-return']);
const PICKUP_CANCELLED = new Set(['pickup-cancelled', 'pickup-cancel']);
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;

/** "order.in-transit", "In Transit" and "In_Transit" all become "in-transit". */
export const normalisePathaoStatus = (value: string): string =>
  value.trim().toLowerCase().replace(/^order\./, '').replace(/[\s_]+/g, '-');

/**
 * Pathao Courier merchant API ("aladdin" v1). OAuth password + refresh grants; paths follow the
 * published Laravel/PHP integrations. Each seller is a Pathao store (pickup point).
 */
@Injectable()
export class PathaoAdapter implements CourierAdapter {
  readonly provider = 'PATHAO' as const;
  private readonly logger = new Logger('Pathao');
  private readonly tokens = new Map<string, { access: string; refresh: string | null; expiresAt: number }>();
  private readonly locationCache = new Map<string, { at: number; rows: CourierLocation[] }>();
  /** Tests point the adapter at a fake server. */
  baseUrlOverride: string | null = null;

  private base(ctx: CourierContext): string {
    return this.baseUrlOverride ?? (ctx.sandbox ? 'https://courier-api-sandbox.pathao.com' : 'https://api-hermes.pathao.com');
  }

  private async grant(ctx: CourierContext, body: Record<string, string>): Promise<boolean> {
    const { status, body: res } = await courierFetch<TokenResponse>(this.logger, 'Pathao', `${this.base(ctx)}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: ctx.credentials.clientId, client_secret: ctx.credentials.clientSecret, ...body }),
    });
    if (status >= 400 || !res.access_token) {
      this.logger.warn(`issue-token (${body.grant_type}) → ${status} ${res.message ?? ''}`);
      return false;
    }
    this.tokens.set(ctx.cacheKey, {
      access: res.access_token,
      refresh: res.refresh_token ?? null,
      expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000,
    });
    return true;
  }

  private async token(ctx: CourierContext): Promise<string> {
    const cached = this.tokens.get(ctx.cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.access;
    const refreshed = cached?.refresh ? await this.grant(ctx, { grant_type: 'refresh_token', refresh_token: cached.refresh }) : false;
    if (!refreshed) {
      const ok = await this.grant(ctx, { grant_type: 'password', username: ctx.credentials.username ?? '', password: ctx.credentials.password ?? '' });
      if (!ok) throw new BadGatewayException('Could not sign in to Pathao. Check the credentials in Admin → Couriers.');
    }
    return this.tokens.get(ctx.cacheKey)!.access;
  }

  /** Calls the API with the bearer token; signs in again once if the token was rejected. */
  private async call<T>(ctx: CourierContext, method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
    const { status, body: res } = await courierFetch<Envelope<T>>(this.logger, 'Pathao', `${this.base(ctx)}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.token(ctx)}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (status === 401 && !retried) {
      this.tokens.delete(ctx.cacheKey);
      return this.call<T>(ctx, method, path, body, true);
    }
    if (status >= 400 || res.data === undefined) {
      this.logger.warn(`${method} ${path} → ${status} ${JSON.stringify(res).slice(0, 500)}`);
      throw new BadGatewayException(`Pathao: ${courierErrorText(res)}`);
    }
    return res.data;
  }

  async testConnection(ctx: CourierContext): Promise<string> {
    this.tokens.delete(ctx.cacheKey);
    await this.token(ctx);
    return 'Signed in to Pathao';
  }

  async book(ctx: CourierContext, req: BookingRequest): Promise<BookingResult> {
    if (!req.storeExternalId) throw new BadGatewayException('Pathao needs a pickup store');
    const data = await this.call<{ consignment_id: string | number; order_status?: string; delivery_fee?: number }>(ctx, 'POST', '/aladdin/api/v1/orders', {
      store_id: Number(req.storeExternalId),
      merchant_order_id: req.reference,
      recipient_name: req.recipientName.slice(0, 100),
      recipient_phone: req.recipientPhone,
      recipient_address: req.recipientAddress.slice(0, 220),
      delivery_type: 48,
      item_type: 2,
      item_quantity: Math.max(1, req.quantity),
      item_weight: req.weightKg,
      amount_to_collect: req.codTaka,
      item_description: req.description.slice(0, 200),
      special_instruction: req.instruction || undefined,
    });
    return {
      consignmentId: String(data.consignment_id),
      trackingCode: null,
      status: data.order_status ?? 'Pending',
      deliveryFeeTaka: toNumber(data.delivery_fee),
    };
  }

  async status(ctx: CourierContext, consignmentId: string): Promise<CourierStatusResult> {
    const data = await this.call<{ order_status?: string; order_status_slug?: string; updated_at?: string }>(
      ctx,
      'GET',
      `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`,
    );
    return { status: data.order_status_slug || data.order_status || '', updatedAt: toDate(data.updated_at) };
  }

  effect(value: string): CourierEffect {
    const k = normalisePathaoStatus(value);
    if (PICKUP_CANCELLED.has(k)) return 'pickup_cancelled';
    if (DELIVERED.has(k)) return 'delivered';
    if (RETURNED.has(k)) return 'returned';
    if (SHIPPED.has(k)) return 'shipped';
    return null; // created, pickup requested, assigned for pickup, pickup failed, …
  }

  /** Pathao sends the webhook secret in X-PATHAO-Signature and expects 202 + an integration header. */
  webhook(headers: Record<string, string | string[] | undefined>, body: unknown, secret: string): WebhookResult {
    const responseHeaders = { 'X-Pathao-Merchant-Webhook-Integration-Secret': env.PATHAO_WEBHOOK_INTEGRATION_SECRET };
    const b = (body ?? {}) as Record<string, unknown>;
    if (b.event === 'webhook_integration') return { authorized: true, update: null, httpStatus: 202, responseHeaders };

    const signature = headerValue(headers, 'x-pathao-signature');
    if (!signature || !timingSafeEqualStrings(signature, secret)) return { authorized: false, update: null, httpStatus: 401, responseHeaders };
    const status = typeof b.event === 'string' ? b.event : typeof b.order_status === 'string' ? b.order_status : null;
    if (b.consignment_id === undefined || b.consignment_id === null || !status) return { authorized: true, update: null, httpStatus: 202, responseHeaders };
    return {
      authorized: true,
      httpStatus: 202,
      responseHeaders,
      update: {
        consignmentId: String(b.consignment_id as string | number),
        status,
        updatedAt: toDate(b.updated_at) ?? toDate(b.timestamp),
        collectedAmount: toNumber(b.collected_amount),
        deliveryFee: toNumber(b.delivery_fee),
      },
    };
  }

  // ───── Stores and locations ─────

  async locations(ctx: CourierContext, kind: 'cities' | 'zones' | 'areas', parentId?: number): Promise<CourierLocation[]> {
    const [path, idKey, nameKey] =
      kind === 'cities'
        ? ['/aladdin/api/v1/countries/1/city-list', 'city_id', 'city_name']
        : kind === 'zones'
          ? [`/aladdin/api/v1/cities/${parentId}/zone-list`, 'zone_id', 'zone_name']
          : [`/aladdin/api/v1/zones/${parentId}/area-list`, 'area_id', 'area_name'];
    const key = `${ctx.sandbox ? 'sb' : 'live'}:${path}`;
    const hit = this.locationCache.get(key);
    if (hit && Date.now() - hit.at < LOCATION_TTL_MS) return hit.rows;
    const data = await this.call<Paged<Record<string, unknown>>>(ctx, 'GET', path);
    const rows = (data.data ?? []).map((r) => ({ id: Number(r[idKey]), name: String(r[nameKey]) }));
    this.locationCache.set(key, { at: Date.now(), rows });
    return rows;
  }

  async createStore(ctx: CourierContext, s: StoreRegistration): Promise<string | null> {
    const data = await this.call<{ store_id?: number | string } | null>(ctx, 'POST', '/aladdin/api/v1/stores', {
      name: s.name,
      contact_name: s.contactName,
      contact_number: s.contactNumber,
      address: s.address,
      city_id: s.cityId,
      zone_id: s.zoneId,
      area_id: s.areaId,
    });
    return data?.store_id !== undefined && data.store_id !== null ? String(data.store_id) : null;
  }

  /** New stores appear in the store list (by name) once Pathao creates them. */
  async findStoreId(ctx: CourierContext, name: string): Promise<string | null> {
    for (let page = 1; page <= 20; page++) {
      const data = await this.call<Paged<{ store_id: number | string; store_name: string }>>(ctx, 'GET', `/aladdin/api/v1/stores?page=${page}`);
      const rows = data.data ?? [];
      const hit = rows.find((s) => s.store_name === name);
      if (hit) return String(hit.store_id);
      if (!data.last_page || page >= data.last_page || rows.length === 0) return null;
    }
    return null;
  }
}
