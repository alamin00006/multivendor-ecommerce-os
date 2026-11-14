import { Global, Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.js';
import { PlatformModeService } from './platform-mode.service.js';
import { SettingsService } from './settings.service.js';

@Global()
@Module({
  controllers: [PlatformController],
  providers: [SettingsService, PlatformModeService],
  exports: [SettingsService, PlatformModeService],
})
export class PlatformModule {}
