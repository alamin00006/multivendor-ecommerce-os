import { Global, Module } from '@nestjs/common';
import { BkashGateway } from './bkash.gateway.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { SslCommerzGateway } from './sslcommerz.gateway.js';

@Global()
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, BkashGateway, SslCommerzGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
