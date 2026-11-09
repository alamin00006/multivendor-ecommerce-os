import { Global, Module } from '@nestjs/common';
import { SellerAccessService } from './seller-access.service.js';
import { AdminSellersController, SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';

@Global()
@Module({
  controllers: [SellersController, AdminSellersController],
  providers: [SellersService, SellerAccessService],
  exports: [SellersService, SellerAccessService],
})
export class SellersModule {}
