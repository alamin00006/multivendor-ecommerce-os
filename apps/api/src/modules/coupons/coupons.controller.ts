import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { CouponsService } from './coupons.service.js';

class CouponDto extends createZodDto(CouponSchema) {}

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Public()
  @Get('available')
  available() {
    return this.coupons.available();
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
  @ResponseMessage('Coupon created')
  create(@Body() dto: CouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Coupon updated')
  update(@Param('id') id: string, @Body() dto: CouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Coupon removed')
  async remove(@Param('id') id: string) {
    await this.coupons.remove(id);
    return null;
  }
}
