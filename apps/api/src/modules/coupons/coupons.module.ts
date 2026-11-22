import { Global, Module } from '@nestjs/common';
import { AdminCouponsController, CouponsController, SellerCouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Global()
@Module({
  controllers: [CouponsController, AdminCouponsController, SellerCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
