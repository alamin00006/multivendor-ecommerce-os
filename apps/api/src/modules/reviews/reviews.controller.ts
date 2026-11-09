import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModerateReviewSchema, PaginationQuerySchema, ReviewListQuerySchema, ReviewSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, ResponseMessage, Roles } from '../../common/decorators.js';
import { ReviewsService } from './reviews.service.js';

class ReviewDto extends createZodDto(ReviewSchema) {}
class ReviewListQueryDto extends createZodDto(ReviewListQuerySchema) {}
class ModerateReviewDto extends createZodDto(ModerateReviewSchema) {}
class PageQueryDto extends createZodDto(PaginationQuerySchema) {}

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:id/reviews')
  list(@Param('id') id: string, @Query() query: ReviewListQueryDto) {
    return this.reviews.list(id, query);
  }

  @Public()
  @Get('products/:id/reviews/summary')
  summary(@Param('id') id: string) {
    return this.reviews.summary(id);
  }

  @ApiBearerAuth()
  @Post('reviews')
  @ResponseMessage('Thanks for your review!')
  create(@CurrentUser() user: AuthUserContext, @Body() dto: ReviewDto) {
    return this.reviews.create(user.id, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: PageQueryDto) {
    return this.reviews.adminList(query);
  }

  @Patch(':id')
  @ResponseMessage('Review updated')
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.moderate(id, dto.isVisible);
  }
}
