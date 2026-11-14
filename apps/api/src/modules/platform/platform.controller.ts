import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdatePlatformSettingsSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { SettingsService } from './settings.service.js';

class UpdatePlatformSettingsDto extends createZodDto(UpdatePlatformSettingsSchema) {}

@ApiTags('settings')
@Controller()
export class PlatformController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/public')
  getPublic() {
    return this.settings.publicSettings();
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Get('admin/settings')
  getAdmin() {
    return this.settings.publicSettings();
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Patch('admin/settings')
  @ResponseMessage('Settings updated')
  update(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: AuthUserContext) {
    return this.settings.update(dto, user.id);
  }
}
