import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { InitiatePaymentSchema } from '@marketbd/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public } from '../../common/decorators.js';
import { PaymentsService } from './payments.service.js';

class InitiatePaymentDto extends createZodDto(InitiatePaymentSchema) {}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get('methods')
  methods() {
    return this.payments.methods();
  }

  @ApiBearerAuth()
  @Post('initiate')
  @HttpCode(200)
  initiate(@CurrentUser() user: AuthUserContext, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiate(user.id, dto.orderId, dto.client);
  }

  @Public()
  @ApiExcludeEndpoint()
  @Get('bkash/callback')
  async bkashCallback(
    @Query('paymentID') paymentID: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ) {
    const url = paymentID
      ? await this.payments.handleBkashCallback(paymentID, status ?? 'failure')
      : this.payments.resultUrl('web', null, 'failed');
    res.redirect(303, url);
  }

  @Public()
  @ApiExcludeEndpoint()
  @Post('sslcommerz/:kind')
  async sslcommerz(
    @Param('kind') kind: string,
    @Body() body: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    const k = kind === 'success' || kind === 'fail' || kind === 'cancel' || kind === 'ipn' ? kind : 'fail';
    const url = await this.payments.handleSslCommerz(k, body);
    if (k === 'ipn') {
      res.status(200).json({ success: true, data: null, message: 'IPN received' });
      return;
    }
    res.redirect(303, url);
  }
}
