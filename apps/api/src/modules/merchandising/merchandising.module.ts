import { Module } from '@nestjs/common';
import { AdminMerchandisingController, MerchandisingController } from './merchandising.controller.js';
import { MerchandisingService } from './merchandising.service.js';

/** Home banners and quick-link chips. */
@Module({
  controllers: [MerchandisingController, AdminMerchandisingController],
  providers: [MerchandisingService],
})
export class MerchandisingModule {}
