import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConversationListQuerySchema, MessageListQuerySchema, SendMessageSchema, StartConversationSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, RequireMultiVendor, Roles } from '../../common/decorators.js';
import { ChatService } from './chat.service.js';

class StartConversationDto extends createZodDto(StartConversationSchema) {}
class SendMessageDto extends createZodDto(SendMessageSchema) {}
class MessageListQueryDto extends createZodDto(MessageListQuerySchema) {}
class ConversationListQueryDto extends createZodDto(ConversationListQuerySchema) {}

/**
 * Thread endpoints are shared by both sides: the service works out whether the caller is the
 * customer, the shop's seller or (for the house store) an admin.
 */
@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('conversations')
  start(@CurrentUser() user: AuthUserContext, @Body() dto: StartConversationDto) {
    return this.chat.start(user.id, dto);
  }

  /** The signed-in customer's threads. */
  @Get('conversations')
  list(@CurrentUser() user: AuthUserContext, @Query() query: ConversationListQueryDto) {
    return this.chat.customerList(user.id, query);
  }

  @Get('unread')
  unread(@CurrentUser() user: AuthUserContext) {
    return this.chat.customerUnread(user.id);
  }

  @Get('conversations/:id/messages')
  thread(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Query() query: MessageListQueryDto) {
    return this.chat.thread(user, id, query.limit);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  send(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.send(user, id, dto);
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  read(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.chat.markRead(user, id);
  }
}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/chat')
export class SellerChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@CurrentUser() user: AuthUserContext, @Query() query: ConversationListQueryDto) {
    return this.chat.sellerList(user.id, query);
  }

  @Get('unread')
  unread(@CurrentUser() user: AuthUserContext) {
    return this.chat.sellerUnread(user.id);
  }
}

/** Admins answer for the house store. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/chat')
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@Query() query: ConversationListQueryDto) {
    return this.chat.storeList(query);
  }

  @Get('unread')
  unread() {
    return this.chat.storeUnread();
  }
}
