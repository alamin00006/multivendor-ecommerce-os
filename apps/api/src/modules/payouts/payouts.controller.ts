import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminPayoutUpdateSchema, PaginationQuerySchema, PayoutAccountSchema, PayoutListQuerySchema, PayoutRequestSchema, SellerReportQuerySchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { PayoutsService } from './payouts.service.js';
import { SellerReportsService } from './reports.service.js';

class PayoutAccountDto extends createZodDto(PayoutAccountSchema) {}
class PayoutRequestDto extends createZodDto(PayoutRequestSchema) {}
class AdminPayoutUpdateDto extends createZodDto(AdminPayoutUpdateSchema) {}
class PayoutListQueryDto extends createZodDto(PayoutListQuerySchema) {}
class PageQueryDto extends createZodDto(PaginationQuerySchema) {}
class SellerReportQueryDto extends createZodDto(SellerReportQuerySchema) {}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller')
export class SellerPayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly reports: SellerReportsService,
  ) {}

  @Get('reports')
  report(@CurrentUser() user: AuthUserContext, @Query() query: SellerReportQueryDto) {
    return this.reports.report(user.id, query);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: AuthUserContext) {
    return this.payouts.summary(user.id);
  }

  @Get('earnings/ledger')
  ledger(@CurrentUser() user: AuthUserContext, @Query() query: PageQueryDto) {
    return this.payouts.ledger(user.id, query);
  }

  @Put('payout-account')
  @ResponseMessage('Payout account saved')
  saveAccount(@CurrentUser() user: AuthUserContext, @Body() dto: PayoutAccountDto) {
    return this.payouts.saveAccount(user.id, dto);
  }

  @Get('payouts')
  list(@CurrentUser() user: AuthUserContext, @Query() query: PayoutListQueryDto) {
    return this.payouts.listMine(user.id, query);
  }

  @Post('payouts')
  @ResponseMessage('Payout requested')
  request(@CurrentUser() user: AuthUserContext, @Body() dto: PayoutRequestDto) {
    return this.payouts.request(user.id, dto);
  }

  @Post('payouts/:id/cancel')
  @ResponseMessage('Payout request cancelled')
  cancel(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.payouts.cancel(user.id, id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@RequireMultiVendor()
@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  list(@Query() query: PayoutListQueryDto) {
    return this.payouts.listAll(query);
  }

  @Patch(':id')
  @ResponseMessage('Payout updated')
  process(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: AdminPayoutUpdateDto) {
    return this.payouts.process(user.id, id, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminReportsController {
  constructor(private readonly reports: SellerReportsService) {}

  @Get('reports')
  report(@Query() query: SellerReportQueryDto) {
    return this.reports.adminReport(query);
  }
}
