import { Module } from '@nestjs/common';
import { AdminPayoutsController, SellerPayoutsController } from './payouts.controller.js';
import { PayoutsService } from './payouts.service.js';
import { SellerReportsService } from './reports.service.js';

@Module({
  controllers: [SellerPayoutsController, AdminPayoutsController],
  providers: [PayoutsService, SellerReportsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
