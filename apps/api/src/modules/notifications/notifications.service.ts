import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationListQuerySchema, type NotificationType, type NotificationView } from '@marketbd/shared';
import type { z } from 'zod';
import type { Notification } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const toView = (n: Notification): NotificationView => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  data: (n.data as Record<string, string> | null) ?? null,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, title, body, data } });
  }

  async list(userId: string, query: z.infer<typeof NotificationListQuerySchema>) {
    const where = { userId, ...(query.unread ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return PaginatedResult.of(rows.map(toView), query.page, query.limit, total);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Notification not found');
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
