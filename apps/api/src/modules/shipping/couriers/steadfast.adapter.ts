import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
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
  timingSafeEqualStrings,
  toDate,
  toNumber,
  type WebhookResult,
} from './courier.adapter.js';

interface SteadfastResponse {
  status?: number | string;
  message?: string;
  errors?: unknown;
  consignment?: { consignment_id?: number | string; tracking_code?: string; status?: string };
  delivery_status?: string;
  current_balance?: number;
}

const DELIVERED = new Set(['delivered', 'partial_delivered', 'delivered_approval_pending', 'partial_delivered_approval_pending']);
const RETURNED = new Set(['cancelled', 'cancelled_approval_pending']);

/**
 * Steadfast Courier (portal.packzy.com). Static api-key/secret-key headers, no per-seller stores:
 * parcels are collected from the pickup address on the Steadfast account.
 */
@Injectable()
export class SteadfastAdapter implements CourierAdapter {
  readonly provider = 'STEADFAST' as const;
  private readonly logger = new Logger('Steadfast');
  /** Tests point the adapter at a fake server. */
  baseUrlOverride: string | null = null;

  private async call(ctx: CourierContext, method: 'GET' | 'POST', path: string, body?: unknown): Promise<SteadfastResponse> {
    const base = this.baseUrlOverride ?? 'https://portal.packzy.com/api/v1';
    const { status, body: res } = await courierFetch<SteadfastResponse>(this.logger, 'Steadfast', `${base}${path}`, {
      method,
      headers: {
        'api-key': ctx.credentials.apiKey ?? '',
        'secret-key': ctx.credentials.secretKey ?? '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (status >= 400 || (res.status !== undefined && Number(res.status) !== 200)) {
      this.logger.warn(`${method} ${path} → ${status} ${JSON.stringify(res).slice(0, 500)}`);
      throw new BadGatewayException(`Steadfast: ${courierErrorText(res)}`);
    }
    return res;
  }

  async testConnection(ctx: CourierContext): Promise<string> {
    const res = await this.call(ctx, 'GET', '/get_balance');
    return `Connected to Steadfast. Balance: ৳${res.current_balance ?? 0}`;
  }

  async book(ctx: CourierContext, req: BookingRequest): Promise<BookingResult> {
    const res = await this.call(ctx, 'POST', '/create_order', {
      invoice: req.reference,
      recipient_name: req.recipientName.slice(0, 100),
      recipient_phone: req.recipientPhone,
      recipient_address: req.recipientAddress.slice(0, 250),
      cod_amount: req.codTaka,
      item_description: req.description.slice(0, 200),
      note: req.instruction || undefined,
    });
    const c = res.consignment;
    if (!c?.consignment_id) throw new BadGatewayException(`Steadfast: ${courierErrorText(res)}`);
    return {
      consignmentId: String(c.consignment_id),
      trackingCode: c.tracking_code ?? null,
      status: c.status ?? 'in_review',
      deliveryFeeTaka: null,
    };
  }

  async status(ctx: CourierContext, consignmentId: string): Promise<CourierStatusResult> {
    const res = await this.call(ctx, 'GET', `/status_by_cid/${encodeURIComponent(consignmentId)}`);
    return { status: res.delivery_status ?? '', updatedAt: null };
  }

  /**
   * Steadfast has no "picked up" status: in_review, pending and hold keep the package as it is.
   * A cancelled parcel counts as returned; before hand-over that means the booking was cancelled.
   */
  effect(value: string): CourierEffect {
    const k = value.trim().toLowerCase();
    if (DELIVERED.has(k)) return 'delivered';
    if (RETURNED.has(k)) return 'returned';
    return null;
  }

  /** Steadfast sends the webhook secret as a Bearer token. Tracking-message events carry no status. */
  webhook(headers: Record<string, string | string[] | undefined>, body: unknown, secret: string): WebhookResult {
    const auth = headerValue(headers, 'authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || !timingSafeEqualStrings(token, secret)) return { authorized: false, update: null, httpStatus: 401 };
    const b = (body ?? {}) as Record<string, unknown>;
    const status = typeof b.status === 'string' ? b.status : null;
    if (b.consignment_id === undefined || b.consignment_id === null || !status) return { authorized: true, update: null, httpStatus: 200 };
    return {
      authorized: true,
      httpStatus: 200,
      update: {
        consignmentId: String(b.consignment_id as string | number),
        status,
        updatedAt: toDate(b.updated_at),
        collectedAmount: DELIVERED.has(status.toLowerCase()) ? toNumber(b.cod_amount) : null,
        deliveryFee: toNumber(b.delivery_charge),
      },
    };
  }
}
