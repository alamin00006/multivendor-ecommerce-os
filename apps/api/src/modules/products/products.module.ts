import { Global, Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { ProductManageService } from './product-manage.service.js';
import { ProductQueryService } from './product-query.service.js';
import { AdminProductsController, ProductsController, SellerProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Global()
@Module({
  imports: [CategoriesModule],
  controllers: [ProductsController, SellerProductsController, AdminProductsController],
  providers: [ProductsService, ProductQueryService, ProductManageService],
  exports: [ProductsService],
})
export class ProductsModule {}
