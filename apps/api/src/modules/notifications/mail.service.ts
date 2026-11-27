import { Injectable, Logger } from '@nestjs/common';
import { BRAND } from '@marketbd/shared';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Email over SMTP (MAIL_PROVIDER=smtp). In development (console) mails are written to the API log. */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: Transporter | null = null;

  get ready(): boolean {
    return env.MAIL_PROVIDER === 'smtp' && Boolean(env.SMTP_HOST);
  }

  get from(): string {
    return env.MAIL_FROM || `${BRAND.name} <no-reply@${new URL(env.WEB_URL).hostname}>`;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.ready) {
      this.logger.log(`Email to ${message.to} (not sent, MAIL_PROVIDER=${env.MAIL_PROVIDER}): ${message.subject}`);
      return;
    }
    this.transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
