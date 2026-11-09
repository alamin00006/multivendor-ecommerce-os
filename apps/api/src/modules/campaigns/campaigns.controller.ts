import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignProductsSchema, CampaignSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { CampaignsService } from './campaigns.service.js';

class CampaignDto extends createZodDto(CampaignSchema) {}
class CampaignProductsDto extends createZodDto(CampaignProductsSchema) {}

@ApiTags('campaigns')
@Public()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  active() {
    return this.campaigns.active();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.campaigns.bySlug(slug);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Post()
  @ResponseMessage('Campaign created')
  create(@Body() dto: CampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Campaign updated')
  update(@Param('id') id: string, @Body() dto: CampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Campaign deleted')
  async remove(@Param('id') id: string) {
    await this.campaigns.remove(id);
    return null;
  }

  @Post(':id/products')
  @ResponseMessage('Products added')
  addProducts(@Param('id') id: string, @Body() dto: CampaignProductsDto) {
    return this.campaigns.addProducts(id, dto.productIds);
  }

  @Post(':id/products/remove')
  @HttpCode(200)
  @ResponseMessage('Products removed')
  removeProducts(@Param('id') id: string, @Body() dto: CampaignProductsDto) {
    return this.campaigns.removeProducts(id, dto.productIds);
  }
}
