import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module.js';
import { CheckoutService } from './checkout.service.js';
import { AdminOrdersController, OrdersController, SellerOrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AddressesModule],
  controllers: [OrdersController, SellerOrdersController, AdminOrdersController],
  providers: [CheckoutService, OrdersService],
})
export class OrdersModule {}
