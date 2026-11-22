import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminChatController, ChatController, SellerChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatRealtime } from './chat.realtime.js';
import { ChatService } from './chat.service.js';

/** Customer ↔ shop messaging (sellers, or admins for the house store), with a Socket.IO channel. */
@Module({
  imports: [JwtModule.register({})],
  controllers: [ChatController, SellerChatController, AdminChatController],
  providers: [ChatService, ChatRealtime, ChatGateway],
})
export class ChatModule {}
