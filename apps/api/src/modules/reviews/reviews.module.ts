import { Module } from '@nestjs/common';
import { AdminReviewsController, ReviewsController, SellerReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController, AdminReviewsController, SellerReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
