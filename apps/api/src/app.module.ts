import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { Public } from './common/decorators.js';
import { JwtAuthGuard, MultiVendorGuard, RolesGuard } from './common/guards.js';
import { ResponseInterceptor } from './common/response.interceptor.js';
import { AddressesModule } from './modules/addresses/addresses.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BrandsModule } from './modules/brands/brands.module.js';
import { CampaignsModule } from './modules/campaigns/campaigns.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { CouponsModule } from './modules/coupons/coupons.module.js';
import { FlashSalesModule } from './modules/flash-sales/flash-sales.module.js';
import { ImagesModule } from './modules/images/images.module.js';
import { MerchandisingModule } from './modules/merchandising/merchandising.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { OrderStatusModule } from './modules/order-status/order-status.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { SellersModule } from './modules/sellers/sellers.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WishlistModule } from './modules/wishlist/wishlist.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    PlatformModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    NotificationsModule,
    CategoriesModule,
    BrandsModule,
    FlashSalesModule,
    ProductsModule,
    SellersModule,
    CartModule,
    WishlistModule,
    CouponsModule,
    OrderStatusModule,
    PaymentsModule,
    OrdersModule,
    ReviewsModule,
    CampaignsModule,
    MerchandisingModule,
    UploadsModule,
    ImagesModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MultiVendorGuard },
  ],
})
export class AppModule {}
