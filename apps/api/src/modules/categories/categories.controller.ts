import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategorySchema, UpdateCategorySchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import { Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { CategoriesService } from './categories.service.js';

class CategoryDto extends createZodDto(CategorySchema) {}
class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}

@ApiTags('categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  tree() {
    return this.categories.tree();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.categories.bySlug(slug);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  tree() {
    return this.categories.adminTree();
  }

  @Post()
  @ResponseMessage('Category created')
  create(@Body() dto: CategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Category updated')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Category deleted')
  async remove(@Param('id') id: string) {
    await this.categories.remove(id);
    return null;
  }
}
