import { Module } from '@nestjs/common';
import { AdminQuestionsController, QuestionsController, SellerQuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';

/** Product Q&A: customers ask, sellers (own products) and admins answer. */
@Module({
  controllers: [QuestionsController, SellerQuestionsController, AdminQuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
