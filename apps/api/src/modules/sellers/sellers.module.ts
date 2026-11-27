import { Global, Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module.js';
import { SellerAccessService } from './seller-access.service.js';
import { AdminSellerDocumentsController, SellerDocumentsController } from './seller-documents.controller.js';
import { SellerDocumentsService } from './seller-documents.service.js';
import { AdminSellersController, SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';

@Global()
@Module({
  imports: [UploadsModule],
  controllers: [SellersController, AdminSellersController, SellerDocumentsController, AdminSellerDocumentsController],
  providers: [SellersService, SellerAccessService, SellerDocumentsService],
  exports: [SellersService, SellerAccessService],
})
export class SellersModule {}
