import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CancelOrderSchema,
  CheckoutPreviewSchema,
  CheckoutSchema,
  OrderListQuerySchema,
  PaginationQuerySchema,
  RefundSchema,
  ReturnRequestSchema,
  ReturnStatusSchema,
  UpdateOrderStatusSchema,
  UpdateReturnSchema,
} from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersService } from './orders.service.js';

class CheckoutDto extends createZodDto(CheckoutSchema) {}
class CheckoutPreviewDto extends createZodDto(CheckoutPreviewSchema) {}
class OrderListQueryDto extends createZodDto(OrderListQuerySchema) {}
class CancelOrderDto extends createZodDto(CancelOrderSchema) {}
class ReturnRequestDto extends createZodDto(ReturnRequestSchema) {}
class UpdateOrderStatusDto extends createZodDto(UpdateOrderStatusSchema) {}
class RefundDto extends createZodDto(RefundSchema) {}
class UpdateReturnDto extends createZodDto(UpdateReturnSchema) {}
class ReturnListQueryDto extends createZodDto(
  PaginationQuerySchema.extend({ status: ReturnStatusSchema.optional() }),
) {}

@ApiTags('orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Post('checkout/preview')
  preview(@CurrentUser() user: AuthUserContext, @Body() dto: CheckoutPreviewDto) {
    return this.checkout.preview(user.id, dto);
  }

  @Post('orders')
  @ResponseMessage('Order placed')
  place(@CurrentUser() user: AuthUserContext, @Body() dto: CheckoutDto) {
    return this.checkout.place(user.id, dto);
  }

  @Get('orders')
  list(@CurrentUser() user: AuthUserContext, @Query() query: OrderListQueryDto) {
    return this.orders.listMine(user.id, query);
  }

  @Get('orders/:id')
  get(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.orders.getMine(user.id, id);
  }

  @Post('orders/:id/cancel')
  @ResponseMessage('Order cancelled')
  cancel(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancelMine(user.id, id, dto);
  }

  @Post('orders/:id/returns')
  @ResponseMessage('Return requested')
  requestReturn(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: ReturnRequestDto) {
    return this.orders.requestReturn(user.id, id, dto);
  }
}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext, @Query() query: OrderListQueryDto) {
    return this.orders.listForSeller(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.orders.getForSeller(user.id, id);
  }

  @Patch(':id/status')
  @ResponseMessage('Order status updated')
  update(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateBySeller(user.id, id, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  list(@Query() query: OrderListQueryDto) {
    return this.orders.listAll(query);
  }

  @Get('orders/:id')
  get(@Param('id') id: string) {
    return this.orders.getAny(id);
  }

  @Patch('orders/:id/status')
  @ResponseMessage('Order status updated')
  status(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.adminSetStatus(user.id, id, dto);
  }

  @Patch('orders/:id/sub-orders/:subOrderId/status')
  @ResponseMessage('Sub-order status updated')
  subStatus(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Param('subOrderId') subOrderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.adminSetStatus(user.id, id, dto, subOrderId);
  }

  @Post('orders/:id/refunds')
  @ResponseMessage('Refund recorded')
  refund(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: RefundDto) {
    return this.orders.refund(user.id, id, dto.amount, dto.reason);
  }

  @Get('returns')
  returns(@Query() query: ReturnListQueryDto) {
    return this.orders.listReturns(query);
  }

  @Patch('returns/:id')
  @ResponseMessage('Return updated')
  updateReturn(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateReturnDto) {
    return this.orders.updateReturn(user.id, id, dto);
  }
}
