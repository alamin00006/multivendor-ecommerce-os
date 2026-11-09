import { Global, Module } from '@nestjs/common';
import { AdminFlashSalesController, FlashSalesController } from './flash-sales.controller.js';
import { FlashSalesService } from './flash-sales.service.js';

@Global()
@Module({
  controllers: [FlashSalesController, AdminFlashSalesController],
  providers: [FlashSalesService],
  exports: [FlashSalesService],
})
export class FlashSalesModule {}
