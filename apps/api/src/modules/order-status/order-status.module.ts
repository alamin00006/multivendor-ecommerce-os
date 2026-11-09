import { Global, Module } from '@nestjs/common';
import { OrderStatusService } from './order-status.service.js';

@Global()
@Module({
  providers: [OrderStatusService],
  exports: [OrderStatusService],
})
export class OrderStatusModule {}
