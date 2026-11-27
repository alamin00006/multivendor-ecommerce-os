import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';

/**
 * Text messages through a Bangladeshi bulk-SMS HTTP gateway (form fields `api_key`, `senderid`,
 * `number`, `message`). Without a gateway configured, messages are written to the API log.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SMS');
  /** Overridable in tests. */
  url = env.SMS_GATEWAY_URL;
  apiKey = env.SMS_GATEWAY_API_KEY;

  get ready(): boolean {
    return Boolean(this.url && this.apiKey);
  }

  /** Throws when the gateway refuses the message. */
  async send(phone: string, message: string): Promise<void> {
    if (!this.ready) {
      this.logger.log(`SMS to ${phone} (no gateway configured): ${message}`);
      return;
    }
    const body = new URLSearchParams({
      api_key: this.apiKey,
      senderid: env.SMS_SENDER_ID,
      number: phone.replace(/^\+/, ''),
      message,
    });
    const res = await fetch(this.url, { method: 'POST', body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`SMS gateway responded ${res.status}`);
  }
}
