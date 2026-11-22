import { Module } from '@nestjs/common';
import { CourierAccountsService } from './courier-accounts.service.js';
import { CourierRegistry } from './couriers/courier.registry.js';
import { PathaoAdapter } from './couriers/pathao.adapter.js';
import { SteadfastAdapter } from './couriers/steadfast.adapter.js';
import {
  AdminShippingController,
  CourierLocationsController,
  CourierWebhookController,
  SellerShippingController,
} from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';

/**
 * Courier integrations. Each courier is an adapter (couriers/*.adapter.ts) registered in
 * CourierRegistry; the admin enables couriers and enters credentials in Admin → Couriers.
 */
@Module({
  controllers: [CourierLocationsController, SellerShippingController, AdminShippingController, CourierWebhookController],
  providers: [PathaoAdapter, SteadfastAdapter, CourierRegistry, CourierAccountsService, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
