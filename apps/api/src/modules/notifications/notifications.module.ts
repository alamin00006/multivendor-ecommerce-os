import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { MessagingController } from './messaging.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { OrderMessagesService } from './order-messages.service.js';
import { PushService } from './push.service.js';
import { SmsService } from './sms.service.js';

@Global()
@Module({
  controllers: [NotificationsController, MessagingController],
  providers: [NotificationsService, PushService, MailService, SmsService, OrderMessagesService],
  exports: [NotificationsService, PushService, MailService, SmsService, OrderMessagesService],
})
export class NotificationsModule {}
