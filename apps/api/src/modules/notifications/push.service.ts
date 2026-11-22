import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Sends notifications to the user's phones through the Expo push service.
 * Best effort: failures are logged and never break the action that triggered them.
 * Tokens Expo reports as no longer registered are removed.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  /** From the environment; tests point these at a fake push server. */
  enabled = env.PUSH_ENABLED;
  url = env.EXPO_PUSH_URL;

  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, token: string, platform: string): Promise<void> {
    // A device belongs to whoever signed in on it last.
    await this.prisma.pushToken.upsert({ where: { token }, create: { userId, token, platform }, update: { userId, platform } });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  async send(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (!this.enabled) return;
    const tokens = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (!tokens.length) return;
    const messages = tokens.map((t) => ({ to: t.token, title, body, data: data ?? {}, sound: 'default', channelId: 'default', priority: 'high' }));
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed with HTTP ${res.status}`);
        return;
      }
      const { data: tickets = [] } = (await res.json()) as { data?: ExpoTicket[] };
      const gone = tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? [tokens[i]!.token] : []));
      if (gone.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: gone } } });
    } catch (error) {
      this.logger.warn(`Expo push failed: ${String(error)}`);
    }
  }
}
