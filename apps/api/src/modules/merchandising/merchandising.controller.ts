import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BannerListQuerySchema, BannerSchema, QuickLinkSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { MerchandisingService } from './merchandising.service.js';

class BannerDto extends createZodDto(BannerSchema) {}
class QuickLinkDto extends createZodDto(QuickLinkSchema) {}
class BannerListQueryDto extends createZodDto(BannerListQuerySchema) {}

@ApiTags('banners')
@Public()
@Controller()
export class MerchandisingController {
  constructor(private readonly merch: MerchandisingService) {}

  @Get('banners')
  banners(@Query() query: BannerListQueryDto) {
    return this.merch.banners(query.placement);
  }

  @Get('quick-links')
  quickLinks() {
    return this.merch.quickLinks();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminMerchandisingController {
  constructor(private readonly merch: MerchandisingService) {}

  @Get('banners')
  banners() {
    return this.merch.allBanners();
  }

  @Post('banners')
  @ResponseMessage('Banner created')
  createBanner(@Body() dto: BannerDto) {
    return this.merch.createBanner(dto);
  }

  @Patch('banners/:id')
  @ResponseMessage('Banner updated')
  updateBanner(@Param('id') id: string, @Body() dto: BannerDto) {
    return this.merch.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @ResponseMessage('Banner deleted')
  async removeBanner(@Param('id') id: string) {
    await this.merch.removeBanner(id);
    return null;
  }

  @Get('quick-links')
  quickLinks() {
    return this.merch.allQuickLinks();
  }

  @Post('quick-links')
  @ResponseMessage('Quick link created')
  createQuickLink(@Body() dto: QuickLinkDto) {
    return this.merch.createQuickLink(dto);
  }

  @Patch('quick-links/:id')
  @ResponseMessage('Quick link updated')
  updateQuickLink(@Param('id') id: string, @Body() dto: QuickLinkDto) {
    return this.merch.updateQuickLink(id, dto);
  }

  @Delete('quick-links/:id')
  @ResponseMessage('Quick link deleted')
  async removeQuickLink(@Param('id') id: string) {
    await this.merch.removeQuickLink(id);
    return null;
  }
}
