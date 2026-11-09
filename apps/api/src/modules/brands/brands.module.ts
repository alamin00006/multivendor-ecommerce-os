import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type BrandPayload,
  BrandSchema,
  type BrandView,
  type UpdateBrandPayload,
  UpdateBrandSchema,
} from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { Brand } from '../../generated/prisma/client.js';
import { Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const toBrandView = (b: Brand): BrandView => ({
  id: b.id,
  name: b.name,
  slug: b.slug,
  logoUrl: b.logoUrl,
  isActive: b.isActive,
});

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive = false): Promise<BrandView[]> {
    const rows = await this.prisma.brand.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toBrandView);
  }

  async create(input: BrandPayload): Promise<BrandView> {
    return toBrandView(await this.prisma.brand.create({ data: input }));
  }

  async update(id: string, input: UpdateBrandPayload): Promise<BrandView> {
    return toBrandView(await this.prisma.brand.update({ where: { id }, data: input }));
  }

  async remove(id: string): Promise<void> {
    if ((await this.prisma.product.count({ where: { brandId: id } })) > 0) {
      throw new BadRequestException('This brand still has products. Deactivate it instead.');
    }
    await this.prisma.brand.delete({ where: { id } });
  }
}

class BrandDto extends createZodDto(BrandSchema) {}
class UpdateBrandDto extends createZodDto(UpdateBrandSchema) {}

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Public()
  @Get()
  list() {
    return this.brands.list();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  list() {
    return this.brands.list(true);
  }

  @Post()
  @ResponseMessage('Brand created')
  create(@Body() dto: BrandDto) {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Brand updated')
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Brand deleted')
  async remove(@Param('id') id: string) {
    await this.brands.remove(id);
    return null;
  }
}

@Module({
  controllers: [BrandsController, AdminBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
