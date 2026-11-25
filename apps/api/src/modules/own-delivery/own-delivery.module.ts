import { Module } from '@nestjs/common';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { AdminOwnDeliveryController, DeliveryDisputeController, SellerOwnDeliveryController } from './own-delivery.controller.js';
import { OwnDeliveryService } from './own-delivery.service.js';

@Module({
  imports: [PayoutsModule],
  controllers: [SellerOwnDeliveryController, AdminOwnDeliveryController, DeliveryDisputeController],
  providers: [OwnDeliveryService],
  exports: [OwnDeliveryService],
})
export class OwnDeliveryModule {}
