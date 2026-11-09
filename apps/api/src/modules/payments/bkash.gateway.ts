import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
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

interface BkashTokenResponse {
  id_token?: string;
  expires_in?: number;
  statusMessage?: string;
}

/** bKash Tokenized Checkout (v1.2.0-beta). Sandbox by default. */
@Injectable()
export class BkashGateway extends PaymentGateway {
  readonly method = 'BKASH' as const;
  private readonly logger = new Logger('bKash');
  private token: { value: string; expiresAt: number } | null = null;

  get enabled(): boolean {
    return env.BKASH_ENABLED && Boolean(env.BKASH_APP_KEY && env.BKASH_APP_SECRET);
  }

  static callbackUrl(): string {
    return `${env.API_PUBLIC_URL}/api/v1/payments/bkash/callback`;
  }

  private async post<T>(path: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<T> {
    const res = await fetch(`${env.BKASH_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json()) as T;
    if (!res.ok) {
      this.logger.error(`${path} → ${res.status} ${JSON.stringify(json)}`);
      throw new BadGatewayException('bKash is not responding. Please try again.');
    }
    return json;
  }

  private async idToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await this.post<BkashTokenResponse>(
      '/tokenized/checkout/token/grant',
      { app_key: env.BKASH_APP_KEY, app_secret: env.BKASH_APP_SECRET },
      { username: env.BKASH_USERNAME, password: env.BKASH_PASSWORD },
    );
    if (!res.id_token) throw new BadGatewayException(res.statusMessage ?? 'bKash authentication failed');
    this.token = { value: res.id_token, expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000 };
    return res.id_token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return { Authorization: await this.idToken(), 'X-APP-Key': env.BKASH_APP_KEY };
  }

  async initiate(ctx: GatewayOrderContext): Promise<GatewayInitResult> {
    const res = await this.post<{ paymentID?: string; bkashURL?: string; statusCode?: string; statusMessage?: string }>(
      '/tokenized/checkout/create',
      {
        mode: '0011',
        payerReference: ctx.customer.phone || ctx.orderNumber,
        callbackURL: BkashGateway.callbackUrl(),
        amount: poishaToTaka(ctx.amount),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: ctx.orderNumber,
      },
      await this.authHeaders(),
    );
    if (!res.paymentID || !res.bkashURL) {
      throw new BadGatewayException(res.statusMessage ?? 'Could not start bKash payment');
    }
    return { redirectUrl: res.bkashURL, gatewayRef: res.paymentID, raw: res };
  }

  async execute(paymentID: string): Promise<GatewayVerifyResult> {
    const res = await this.post<{ transactionStatus?: string; trxID?: string; amount?: string; statusCode?: string }>(
      '/tokenized/checkout/execute',
      { paymentID },
      await this.authHeaders(),
    );
    return {
      success: res.transactionStatus === 'Completed' && res.statusCode === '0000',
      amount: res.amount ? takaToPoisha(res.amount) : null,
      trxId: res.trxID ?? null,
      raw: res,
    };
  }

  async refund(
    payment: { gatewayRef: string | null; gatewayTrxId: string | null },
    amount: number,
    reason: string,
  ): Promise<GatewayRefundResult> {
    if (!payment.gatewayRef || !payment.gatewayTrxId) return { success: false, gatewayRef: null, raw: {} };
    const res = await this.post<{ refundTrxID?: string; transactionStatus?: string }>(
      '/tokenized/checkout/payment/refund',
      {
        paymentID: payment.gatewayRef,
        trxID: payment.gatewayTrxId,
        amount: poishaToTaka(amount),
        sku: 'refund',
        reason: reason.slice(0, 255),
      },
      await this.authHeaders(),
    );
    return { success: res.transactionStatus === 'Completed', gatewayRef: res.refundTrxID ?? null, raw: res };
  }
}
