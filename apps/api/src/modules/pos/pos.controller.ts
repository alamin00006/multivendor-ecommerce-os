import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PosProductQuerySchema, PosSaleSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { PosService } from './pos.service.js';

class PosProductQueryDto extends createZodDto(PosProductQuerySchema) {}
class PosSaleDto extends createZodDto(PosSaleSchema) {}

/** Same counter for both panels: admin sells house-store stock, a seller sells their own shop's stock. */
abstract class PosEndpoints {
  constructor(protected readonly pos: PosService) {}

  @Get('products')
  async products(@CurrentUser() user: AuthUserContext, @Query() query: PosProductQueryDto) {
    return this.pos.products(await this.pos.shopFor(user), query);
  }

  @Post('sales')
  @ResponseMessage('Sale completed')
  async sell(@CurrentUser() user: AuthUserContext, @Body() dto: PosSaleDto) {
    return this.pos.sell(user.id, await this.pos.shopFor(user), dto);
  }

  @Get('sales/:id')
  async receipt(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.pos.receipt(await this.pos.shopFor(user), id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/pos')
export class PosController extends PosEndpoints {
  constructor(pos: PosService) {
    super(pos);
  }
}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/pos')
export class SellerPosController extends PosEndpoints {
  constructor(pos: PosService) {
    super(pos);
  }
}
