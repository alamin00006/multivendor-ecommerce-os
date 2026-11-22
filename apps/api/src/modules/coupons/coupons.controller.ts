import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponSchema, SellerCouponSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, OptionalUser, Public, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { CouponsService } from './coupons.service.js';

class CouponDto extends createZodDto(CouponSchema) {}
class SellerCouponDto extends createZodDto(SellerCouponSchema) {}

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /** Public; when a token is sent, each voucher says whether the viewer collected it. */
  @Public()
  @Get('available')
  available(@OptionalUser() user: AuthUserContext | null) {
    return this.coupons.available(user?.id);
  }

  @ApiBearerAuth()
  @Get('mine')
  mine(@CurrentUser() user: AuthUserContext) {
    return this.coupons.mine(user.id);
  }

  @ApiBearerAuth()
  @Post(':id/collect')
  @ResponseMessage('Voucher collected')
  collect(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.coupons.collect(user.id, id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.list();
  }

  @Post()
  @ResponseMessage('Voucher created')
  create(@Body() dto: CouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Voucher updated')
  update(@Param('id') id: string, @Body() dto: CouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Voucher removed')
  async remove(@Param('id') id: string) {
    await this.coupons.remove(id);
    return null;
  }
}

/** Sellers run vouchers for their own shop (STORE scope is forced). */
@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/coupons')
export class SellerCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext) {
    return this.coupons.sellerList(user.id);
  }

  @Post()
  @ResponseMessage('Voucher created')
  create(@CurrentUser() user: AuthUserContext, @Body() dto: SellerCouponDto) {
    return this.coupons.sellerCreate(user.id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Voucher updated')
  update(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: SellerCouponDto) {
    return this.coupons.sellerUpdate(user.id, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Voucher removed')
  async remove(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    await this.coupons.sellerRemove(user.id, id);
    return null;
  }
}
