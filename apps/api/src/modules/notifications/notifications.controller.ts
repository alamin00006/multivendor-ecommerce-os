import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationListQuerySchema, PushTokenSchema, RemovePushTokenSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser } from '../../common/decorators.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';

class NotificationListQueryDto extends createZodDto(NotificationListQuerySchema) {}
class PushTokenDto extends createZodDto(PushTokenSchema) {}
class RemovePushTokenDto extends createZodDto(RemovePushTokenSchema) {}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  /** The app registers its Expo push token after sign-in. */
  @Post('push-token')
  @HttpCode(200)
  async registerPush(@CurrentUser() user: AuthUserContext, @Body() dto: PushTokenDto) {
    await this.push.register(user.id, dto.token, dto.platform);
    return null;
  }

  /** Called on sign-out so the phone stops receiving this account's notifications. */
  @Delete('push-token')
  async removePush(@CurrentUser() user: AuthUserContext, @Body() dto: RemovePushTokenDto) {
    await this.push.unregister(user.id, dto.token);
    return null;
  }

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
