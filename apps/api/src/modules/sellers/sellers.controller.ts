import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  SellerAdminUpdateSchema,
  SellerListQuerySchema,
  SellerRegisterSchema,
  UpdateShopSchema,
} from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { SellersService } from './sellers.service.js';

class SellerRegisterDto extends createZodDto(SellerRegisterSchema) {}
class UpdateShopDto extends createZodDto(UpdateShopSchema) {}
class SellerAdminUpdateDto extends createZodDto(SellerAdminUpdateSchema) {}
class SellerListQueryDto extends createZodDto(SellerListQuerySchema) {}

@ApiTags('sellers')
@RequireMultiVendor()
@Controller()
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Public()
  @Get('shops/:slug')
  shop(@Param('slug') slug: string) {
    return this.sellers.shop(slug);
  }

  @ApiBearerAuth()
  @Post('sellers/register')
  @ResponseMessage('Application submitted. We will notify you after review.')
  register(@CurrentUser() user: AuthUserContext, @Body() dto: SellerRegisterDto) {
    return this.sellers.register(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('sellers/me')
  me(@CurrentUser() user: AuthUserContext) {
    return this.sellers.me(user.id);
  }

  @ApiBearerAuth()
  @Roles('SELLER')
  @Patch('sellers/me')
  @ResponseMessage('Shop updated')
  update(@CurrentUser() user: AuthUserContext, @Body() dto: UpdateShopDto) {
    return this.sellers.updateShop(user.id, dto);
  }

  @ApiBearerAuth()
  @Roles('SELLER')
  @Get('seller/dashboard')
  dashboard(@CurrentUser() user: AuthUserContext) {
    return this.sellers.dashboard(user.id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@RequireMultiVendor()
@Controller('admin/sellers')
export class AdminSellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  list(@Query() query: SellerListQueryDto) {
    return this.sellers.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sellers.adminGet(id);
  }

  @Patch(':id')
  @ResponseMessage('Seller updated')
  update(@Param('id') id: string, @Body() dto: SellerAdminUpdateDto) {
    return this.sellers.adminUpdate(id, dto);
  }
}
