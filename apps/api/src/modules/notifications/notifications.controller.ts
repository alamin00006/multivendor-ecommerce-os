import { Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationListQuerySchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser } from '../../common/decorators.js';
import { NotificationsService } from './notifications.service.js';

class NotificationListQueryDto extends createZodDto(NotificationListQuerySchema) {}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext, @Query() query: NotificationListQueryDto) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUserContext) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
    return null;
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: AuthUserContext) {
    await this.notifications.markAllRead(user.id);
    return null;
  }
}
