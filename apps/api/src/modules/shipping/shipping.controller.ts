import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { BookShipmentSchema, CourierAccountSchema, CourierStoreSchema } from '@marketbd/shared';
import type { Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { CourierAccountsService } from './courier-accounts.service.js';
import { CourierRegistry } from './couriers/courier.registry.js';
import { ShippingService } from './shipping.service.js';

class CourierStoreDto extends createZodDto(CourierStoreSchema) {}
class CourierAccountDto extends createZodDto(CourierAccountSchema) {}
class BookShipmentDto extends createZodDto(BookShipmentSchema) {}

/** Courier location lists for the pickup-address form (couriers with stores only). */
@ApiTags('courier')
@ApiBearerAuth()
@Roles('SELLER', 'ADMIN')
@Controller('couriers/:provider')
export class CourierLocationsController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('cities')
  cities(@Param('provider') provider: string) {
    return this.shipping.locations(CourierRegistry.parse(provider), 'cities');
  }

  @Get('cities/:id/zones')
  zones(@Param('provider') provider: string, @Param('id', ParseIntPipe) id: number) {
    return this.shipping.locations(CourierRegistry.parse(provider), 'zones', id);
  }

  @Get('zones/:id/areas')
  areas(@Param('provider') provider: string, @Param('id', ParseIntPipe) id: number) {
    return this.shipping.locations(CourierRegistry.parse(provider), 'areas', id);
  }
}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller')
export class SellerShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** Enabled couriers and this shop's pickup store at each. */
  @Get('couriers')
  options(@CurrentUser() user: AuthUserContext) {
    return this.shipping.sellerOptions(user.id);
  }

  @Put('couriers/:provider/store')
  @ResponseMessage('Pickup address sent to the courier')
  saveStore(@CurrentUser() user: AuthUserContext, @Param('provider') provider: string, @Body() dto: CourierStoreDto) {
    return this.shipping.saveSellerStore(user.id, CourierRegistry.parse(provider), dto);
  }

  @Post('orders/:id/shipment')
  @ResponseMessage('Courier booked')
  book(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: BookShipmentDto) {
    return this.shipping.bookForSeller(user.id, id, dto);
  }

  @Post('orders/:id/shipment/sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.shipping.syncForSeller(user.id, id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly accounts: CourierAccountsService,
  ) {}

  /** Every supported courier and how it is configured. */
  @Get('couriers')
  list() {
    return this.accounts.list();
  }

  @Put('couriers/:provider')
  @ResponseMessage('Courier saved')
  save(@Param('provider') provider: string, @Body() dto: CourierAccountDto) {
    return this.accounts.save(CourierRegistry.parse(provider), dto);
  }

  @Post('couriers/:provider/test')
  @HttpCode(200)
  test(@Param('provider') provider: string) {
    return this.accounts.test(CourierRegistry.parse(provider));
  }

  @Post('couriers/:provider/webhook-secret')
  @HttpCode(200)
  @ResponseMessage('Webhook secret changed. Update it in the courier panel.')
  rotate(@Param('provider') provider: string) {
    return this.accounts.rotateWebhookSecret(CourierRegistry.parse(provider));
  }

  /** Courier options of the house store (the admin ships its own products). */
  @Get('courier-options')
  houseOptions() {
    return this.shipping.houseOptions();
  }

  @Put('courier-options/:provider/store')
  @ResponseMessage('Pickup address sent to the courier')
  saveHouseStore(@Param('provider') provider: string, @Body() dto: CourierStoreDto) {
    return this.shipping.saveHouseStore(CourierRegistry.parse(provider), dto);
  }

  @Post('orders/:id/sub-orders/:subOrderId/shipment')
  @ResponseMessage('Courier booked')
  book(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Param('subOrderId') subOrderId: string, @Body() dto: BookShipmentDto) {
    return this.shipping.bookForAdmin(user.id, id, subOrderId, dto);
  }

  @Post('orders/:id/sub-orders/:subOrderId/shipment/sync')
  @HttpCode(200)
  sync(@Param('id') id: string, @Param('subOrderId') subOrderId: string) {
    return this.shipping.syncForAdmin(id, subOrderId);
  }
}

/** Courier status webhooks: <API_PUBLIC_URL>/api/v1/webhooks/<courier>, shown in Admin → Couriers. */
@ApiTags('webhooks')
@Public()
@SkipThrottle()
@Controller('webhooks')
export class CourierWebhookController {
  constructor(private readonly shipping: ShippingService) {}

  @Post(':provider')
  @ApiExcludeEndpoint()
  async receive(@Param('provider') provider: string, @Req() req: Request, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.shipping.handleWebhook(CourierRegistry.parse(provider), req.headers, body);
    for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    res.status(result.httpStatus);
    return result.httpStatus === 401 ? { success: false, message: 'Invalid webhook signature' } : { success: true };
  }
}
