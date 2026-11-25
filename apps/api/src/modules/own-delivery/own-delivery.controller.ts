import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeliveryDisputeSchema, OwnDeliveryDecisionSchema, OwnDeliverySchema, ResolveDisputeSchema, SellerAdjustmentSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { OwnDeliveryService } from './own-delivery.service.js';

class OwnDeliveryDto extends createZodDto(OwnDeliverySchema) {}
class DecisionDto extends createZodDto(OwnDeliveryDecisionSchema) {}
class AdjustmentDto extends createZodDto(SellerAdjustmentSchema) {}
class DisputeDto extends createZodDto(DeliveryDisputeSchema) {}
class ResolveDto extends createZodDto(ResolveDisputeSchema) {}
class StatusQueryDto extends createZodDto(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() })) {}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/own-delivery')
export class SellerOwnDeliveryController {
  constructor(private readonly own: OwnDeliveryService) {}

  @Get()
  get(@CurrentUser() user: AuthUserContext) {
    return this.own.mine(user.id);
  }

  @Put()
  @ResponseMessage('Sent to MarketBD for approval')
  request(@CurrentUser() user: AuthUserContext, @Body() dto: OwnDeliveryDto) {
    return this.own.request(user.id, dto);
  }

  @Delete()
  @ResponseMessage('Switched to MarketBD Delivery')
  stop(@CurrentUser() user: AuthUserContext) {
    return this.own.stop(user.id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@RequireMultiVendor()
@Controller('admin')
export class AdminOwnDeliveryController {
  constructor(private readonly own: OwnDeliveryService) {}

  @Get('own-delivery')
  list(@Query() query: StatusQueryDto) {
    return this.own.list(query.status);
  }

  @Patch('own-delivery/:sellerId')
  @ResponseMessage('Delivery method updated')
  decide(@Param('sellerId') sellerId: string, @Body() dto: DecisionDto) {
    return this.own.decide(sellerId, dto);
  }

  @Get('sellers/:sellerId/adjustments')
  adjustments(@Param('sellerId') sellerId: string) {
    return this.own.adjustments(sellerId);
  }

  @Post('sellers/:sellerId/adjustments')
  @ResponseMessage('Payment recorded')
  addAdjustment(@CurrentUser() user: AuthUserContext, @Param('sellerId') sellerId: string, @Body() dto: AdjustmentDto) {
    return this.own.addAdjustment(user.id, sellerId, dto);
  }

  @Get('delivery-disputes')
  disputes() {
    return this.own.openDisputes();
  }

  @Post('orders/:orderId/sub-orders/:subOrderId/dispute/resolve')
  @HttpCode(200)
  @ResponseMessage('Complaint resolved')
  async resolve(@Param('orderId') orderId: string, @Param('subOrderId') subOrderId: string, @Body() dto: ResolveDto) {
    await this.own.resolve(orderId, subOrderId, dto);
    return null;
  }
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class DeliveryDisputeController {
  constructor(private readonly own: OwnDeliveryService) {}

  /** Customer: "I did not receive this package". */
  @Post(':orderId/packages/:subOrderId/not-received')
  @ResponseMessage('Thanks — we are looking into it')
  async dispute(@CurrentUser() user: AuthUserContext, @Param('orderId') orderId: string, @Param('subOrderId') subOrderId: string, @Body() dto: DisputeDto) {
    await this.own.dispute(user.id, orderId, subOrderId, dto);
    return null;
  }
}
