import type { PaymentMethod } from '@marketbd/shared';

export interface GatewayOrderContext {
  paymentId: string;
  orderNumber: string;
  amount: number; // poisha
  customer: { name: string; email: string | null; phone: string };
  address: { line: string; city: string };
  productName: string;
}

export interface GatewayInitResult {
  redirectUrl: string;
  gatewayRef: string;
  raw: Record<string, unknown>;
}

export interface GatewayVerifyResult {
  success: boolean;
  amount: number | null; // poisha, when the gateway reports it
  trxId: string | null;
  raw: Record<string, unknown>;
}

export interface GatewayRefundResult {
  success: boolean;
  gatewayRef: string | null;
  raw: Record<string, unknown>;
}

/** An online payment provider. Implementations are selected by PaymentMethod. */
export abstract class PaymentGateway {
  abstract readonly method: Exclude<PaymentMethod, 'COD'>;
  abstract get enabled(): boolean;
  abstract initiate(ctx: GatewayOrderContext): Promise<GatewayInitResult>;
  abstract refund(
    payment: { gatewayRef: string | null; gatewayTrxId: string | null; amount: number },
    amount: number,
    reason: string,
  ): Promise<GatewayRefundResult>;
}

export const poishaToTaka = (poisha: number): string => (poisha / 100).toFixed(2);
export const takaToPoisha = (taka: string | number): number => Math.round(Number(taka) * 100);
