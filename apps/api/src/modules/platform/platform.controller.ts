import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdatePlatformSettingsSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { PlatformModeService } from './platform-mode.service.js';

class UpdatePlatformSettingsDto extends createZodDto(UpdatePlatformSettingsSchema) {}

@ApiTags('settings')
@Controller()
export class PlatformController {
  constructor(private readonly mode: PlatformModeService) {}

  @Public()
  @Get('settings/public')
  getPublic() {
    return this.mode.getPublicSettings();
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Get('admin/settings')
  getAdmin() {
    return this.mode.getPublicSettings();
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @Patch('admin/settings')
  @ResponseMessage('Settings updated')
  update(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: AuthUserContext) {
    return this.mode.setMultiVendor(dto.multiVendorEnabled, user.id);
  }
}
