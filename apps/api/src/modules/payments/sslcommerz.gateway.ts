import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { BRAND } from '@marketbd/shared';
import { env } from '../../config/env.js';
import {
  type GatewayInitResult,
  type GatewayOrderContext,
  type GatewayRefundResult,
  type GatewayVerifyResult,
  PaymentGateway,
  poishaToTaka,
  takaToPoisha,
} from './payment-gateway.js';

/** SSLCommerz hosted checkout (cards, mobile banking, net banking). Sandbox by default. */
@Injectable()
export class SslCommerzGateway extends PaymentGateway {
  readonly method = 'SSLCOMMERZ' as const;
  private readonly logger = new Logger('SSLCommerz');

  get enabled(): boolean {
    return env.SSLCOMMERZ_ENABLED && Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD);
  }

  private callback(kind: 'success' | 'fail' | 'cancel' | 'ipn'): string {
    return `${env.API_PUBLIC_URL}/api/v1/payments/sslcommerz/${kind}`;
  }

  async initiate(ctx: GatewayOrderContext): Promise<GatewayInitResult> {
    const body = new URLSearchParams({
      store_id: env.SSLCOMMERZ_STORE_ID,
      store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
      total_amount: poishaToTaka(ctx.amount),
      currency: 'BDT',
      tran_id: ctx.paymentId,
      success_url: this.callback('success'),
      fail_url: this.callback('fail'),
      cancel_url: this.callback('cancel'),
      ipn_url: this.callback('ipn'),
      cus_name: ctx.customer.name,
      cus_email: ctx.customer.email ?? BRAND.supportEmail,
      cus_phone: ctx.customer.phone,
      cus_add1: ctx.address.line,
      cus_city: ctx.address.city,
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      product_name: ctx.productName.slice(0, 250),
      product_category: 'General',
      product_profile: 'general',
      value_a: ctx.orderNumber,
    });
    const res = await fetch(`${env.SSLCOMMERZ_BASE_URL}/gwprocess/v4/api.php`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json()) as { status?: string; GatewayPageURL?: string; failedreason?: string };
    if (json.status !== 'SUCCESS' || !json.GatewayPageURL) {
      this.logger.error(`init failed: ${json.failedreason ?? res.status}`);
      throw new BadGatewayException(json.failedreason ?? 'Could not start card payment');
    }
    return { redirectUrl: json.GatewayPageURL, gatewayRef: ctx.paymentId, raw: json };
  }

  /** Server-side validation of a callback's val_id — never trust the browser POST alone. */
  async validate(valId: string): Promise<GatewayVerifyResult & { tranId: string | null }> {
    const url = new URL(`${env.SSLCOMMERZ_BASE_URL}/validator/api/validationserverAPI.php`);
    url.search = new URLSearchParams({
      val_id: valId,
      store_id: env.SSLCOMMERZ_STORE_ID,
      store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
      v: '1',
      format: 'json',
    }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const json = (await res.json()) as { status?: string; tran_id?: string; amount?: string; bank_tran_id?: string };
    return {
      success: json.status === 'VALID' || json.status === 'VALIDATED',
      amount: json.amount ? takaToPoisha(json.amount) : null,
      trxId: json.bank_tran_id ?? null,
      tranId: json.tran_id ?? null,
      raw: json,
    };
  }

  async refund(payment: { gatewayTrxId: string | null }, amount: number, reason: string): Promise<GatewayRefundResult> {
    if (!payment.gatewayTrxId) return { success: false, gatewayRef: null, raw: {} };
    const url = new URL(`${env.SSLCOMMERZ_BASE_URL}/validator/api/merchantTransIDvalidationAPI.php`);
    url.search = new URLSearchParams({
      bank_tran_id: payment.gatewayTrxId,
      refund_amount: poishaToTaka(amount),
      refund_remarks: reason.slice(0, 255),
      store_id: env.SSLCOMMERZ_STORE_ID,
      store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
      format: 'json',
    }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const json = (await res.json()) as { APIConnect?: string; status?: string; refund_ref_id?: string };
    return {
      success: json.APIConnect === 'DONE' && json.status === 'success',
      gatewayRef: json.refund_ref_id ?? null,
      raw: json,
    };
  }
}
