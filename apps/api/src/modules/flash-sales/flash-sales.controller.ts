import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FlashSaleSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { FlashSalesService } from './flash-sales.service.js';

class FlashSaleDto extends createZodDto(FlashSaleSchema) {}

@ApiTags('flash-sales')
@Controller('flash-sales')
export class FlashSalesController {
  constructor(private readonly flashSales: FlashSalesService) {}

  @Public()
  @Get('active')
  active() {
    return this.flashSales.active();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/flash-sales')
export class AdminFlashSalesController {
  constructor(private readonly flashSales: FlashSalesService) {}

  @Get()
  list() {
    return this.flashSales.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.flashSales.get(id);
  }

  @Post()
  @ResponseMessage('Flash sale created')
  create(@Body() dto: FlashSaleDto) {
    return this.flashSales.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Flash sale updated')
  update(@Param('id') id: string, @Body() dto: FlashSaleDto) {
    return this.flashSales.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Flash sale removed')
  async remove(@Param('id') id: string) {
    await this.flashSales.remove(id);
    return null;
  }
}
