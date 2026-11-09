import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BRAND } from '@marketbd/shared';
import { env } from '../../config/env.js';

/** Delivery channel for one-time codes. Swap implementations via OTP_PROVIDER. */
export abstract class OtpSender {
  abstract send(phone: string, code: string): Promise<void>;
}

export const otpMessage = (code: string) =>
  `${code} is your ${BRAND.name} verification code. It expires in 5 minutes. Do not share it with anyone.`;

/** Development sender: writes the code to the API log. */
@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly logger = new Logger('OTP');

  send(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code}`);
    return Promise.resolve();
  }
}

/**
 * Generic HTTP SMS gateway (works with most Bangladeshi bulk-SMS providers that accept
 * `api_key`, `senderid`, `number`, `message` as form fields).
 */
@Injectable()
export class HttpSmsOtpSender extends OtpSender {
  private readonly logger = new Logger('SmsOtpSender');

  async send(phone: string, code: string): Promise<void> {
    if (!env.SMS_GATEWAY_URL || !env.SMS_GATEWAY_API_KEY) {
      throw new ServiceUnavailableException('SMS gateway is not configured');
    }
    const body = new URLSearchParams({
      api_key: env.SMS_GATEWAY_API_KEY,
      senderid: env.SMS_SENDER_ID,
      number: phone.replace(/^\+/, ''),
      message: otpMessage(code),
    });
    const res = await fetch(env.SMS_GATEWAY_URL, { method: 'POST', body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      this.logger.error(`SMS gateway responded ${res.status}`);
      throw new ServiceUnavailableException('Could not send the verification code. Please try again.');
    }
  }
}
