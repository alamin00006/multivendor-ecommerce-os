import { Global, Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.js';
import { PlatformModeService } from './platform-mode.service.js';

@Global()
@Module({
  controllers: [PlatformController],
  providers: [PlatformModeService],
  exports: [PlatformModeService],
})
export class PlatformModule {}
