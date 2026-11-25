import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module.js';
import { OwnDeliveryModule } from '../own-delivery/own-delivery.module.js';
import { CheckoutService } from './checkout.service.js';
import { AdminOrdersController, OrdersController, SellerOrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AddressesModule, OwnDeliveryModule],
  controllers: [OrdersController, SellerOrdersController, AdminOrdersController],
  providers: [CheckoutService, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
