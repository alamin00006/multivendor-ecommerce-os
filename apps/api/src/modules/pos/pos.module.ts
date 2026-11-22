import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { PosController, SellerPosController } from './pos.controller.js';
import { PosService } from './pos.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [PosController, SellerPosController],
  providers: [PosService],
})
export class PosModule {}
