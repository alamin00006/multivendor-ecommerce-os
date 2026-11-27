import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BRAND, MessagingSettingsSchema, MessagingTestSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage, Roles } from '../../common/decorators.js';
import { SettingsService } from '../platform/settings.service.js';
import { MailService } from './mail.service.js';
import { OrderMessagesService } from './order-messages.service.js';
import { SmsService } from './sms.service.js';

class MessagingSettingsDto extends createZodDto(MessagingSettingsSchema) {}
class MessagingTestDto extends createZodDto(MessagingTestSchema) {}

/** Admin → Settings → Messages: order emails / SMS switches and a test send. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/settings/messaging')
export class MessagingController {
  constructor(
    private readonly messages: OrderMessagesService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  @Get()
  get() {
    return this.messages.messagingSettings();
  }

  @Put()
  @ResponseMessage('Message settings saved')
  async save(@CurrentUser() user: AuthUserContext, @Body() dto: MessagingSettingsDto) {
    await this.settings.save(dto, user.id);
    return this.messages.messagingSettings();
  }

  @Post('test')
  @ResponseMessage('Test message sent')
  async test(@Body() dto: MessagingTestDto) {
    if (dto.channel === 'email') {
      await this.mail.send({
        to: dto.to,
        subject: `${BRAND.name} test email`,
        text: `This is a test email from ${BRAND.name}. Order emails will look like they come from ${this.mail.from}.`,
        html: `<p>This is a test email from <b>${BRAND.name}</b>.</p><p>Order emails will come from ${this.mail.from.replace(/</g, '&lt;')}.</p>`,
      });
      return { delivered: this.mail.ready };
    }
    await this.sms.send(dto.to, `${BRAND.name}: test SMS. Order updates will look like this.`);
    return { delivered: this.sms.ready };
  }
}
