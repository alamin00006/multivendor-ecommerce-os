import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ManageProductListQuerySchema,
  ProductListQuerySchema,
  ProductSchema,
  ProductStatusSchema,
  SearchSuggestQuerySchema,
  UpdateProductSchema,
  UpdateStockSchema,
} from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { SellerAccessService } from '../sellers/seller-access.service.js';
import { ProductManageService } from './product-manage.service.js';
import { ProductsService } from './products.service.js';

class ProductListQueryDto extends createZodDto(ProductListQuerySchema) {}
class FacetsQueryDto extends createZodDto(ProductListQuerySchema.omit({ page: true, limit: true, sort: true })) {}
class SearchSuggestQueryDto extends createZodDto(SearchSuggestQuerySchema) {}
class ManageProductListQueryDto extends createZodDto(ManageProductListQuerySchema) {}
class ProductDto extends createZodDto(ProductSchema) {}
class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
class UpdateStockDto extends createZodDto(UpdateStockSchema) {}
class ProductStatusDto extends createZodDto(z.object({ status: ProductStatusSchema })) {}

@ApiTags('products')
@Public()
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('products')
  list(@Query() query: ProductListQueryDto) {
    return this.products.list(query);
  }

  @Get('products/facets')
  facets(@Query() query: FacetsQueryDto) {
    return this.products.facets(query);
  }

  @Get('products/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.products.bySlug(slug);
  }

  @Get('products/:slug/bought-together')
  boughtTogether(@Param('slug') slug: string) {
    return this.products.boughtTogether(slug);
  }

  @Get('products/:slug/related')
  related(@Param('slug') slug: string) {
    return this.products.related(slug);
  }

  @Get('search/suggest')
  suggest(@Query() query: SearchSuggestQueryDto) {
    return this.products.suggest(query.q, query.limit);
  }
}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/products')
export class SellerProductsController {
  constructor(
    private readonly manage: ProductManageService,
    private readonly access: SellerAccessService,
  ) {}

  private async scope(user: AuthUserContext) {
    return { sellerId: (await this.access.requireActiveSeller(user.id)).id };
  }

  @Get()
  async list(@CurrentUser() user: AuthUserContext, @Query() query: ManageProductListQueryDto) {
    return this.manage.list(await this.scope(user), query);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.manage.get(await this.scope(user), id);
  }

  @Post()
  @ResponseMessage('Product created')
  async create(@CurrentUser() user: AuthUserContext, @Body() dto: ProductDto) {
    const { sellerId } = await this.scope(user);
    return this.manage.create(sellerId, dto);
  }

  @Patch('stock')
  @ResponseMessage('Stock updated')
  async stock(@CurrentUser() user: AuthUserContext, @Body() dto: UpdateStockDto) {
    await this.manage.updateStock(await this.scope(user), dto);
    return null;
  }

  @Patch(':id')
  @ResponseMessage('Product updated')
  async update(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.manage.update(await this.scope(user), id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.manage.remove(await this.scope(user), id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly manage: ProductManageService,
    private readonly access: SellerAccessService,
  ) {}

  /** All products (any seller) — admins create into the house store. */
  @Get()
  list(@Query() query: ManageProductListQueryDto) {
    return this.manage.list({}, query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.manage.get({}, id);
  }

  @Post()
  @ResponseMessage('Product created')
  async create(@Body() dto: ProductDto) {
    const house = await this.access.houseStore();
    return this.manage.create(house.id, dto);
  }

  @Patch('stock')
  @ResponseMessage('Stock updated')
  async stock(@Body() dto: UpdateStockDto) {
    await this.manage.updateStock({}, dto);
    return null;
  }

  @Patch(':id/status')
  @ResponseMessage('Product status updated')
  status(@Param('id') id: string, @Body() dto: ProductStatusDto) {
    return this.manage.setStatus(id, dto.status);
  }

  @Patch(':id')
  @ResponseMessage('Product updated')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.manage.update({}, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manage.remove({}, id);
  }
}
