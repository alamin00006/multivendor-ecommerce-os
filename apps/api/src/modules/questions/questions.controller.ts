import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AnswerQuestionSchema,
  AskQuestionSchema,
  ModerateQuestionSchema,
  QuestionListQuerySchema,
} from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import { QuestionsService } from './questions.service.js';

class AskQuestionDto extends createZodDto(AskQuestionSchema) {}
class AnswerQuestionDto extends createZodDto(AnswerQuestionSchema) {}
class ModerateQuestionDto extends createZodDto(ModerateQuestionSchema) {}
class QuestionListQueryDto extends createZodDto(QuestionListQuerySchema) {}

@ApiTags('questions')
@Controller()
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Public()
  @Get('products/:id/questions')
  list(@Param('id') id: string, @Query() query: QuestionListQueryDto) {
    return this.questions.list(id, query);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('products/:id/questions')
  @ResponseMessage('Question sent. You will be notified when it is answered.')
  ask(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: AskQuestionDto) {
    return this.questions.ask(user.id, id, dto.question);
  }
}

@ApiTags('seller')
@ApiBearerAuth()
@Roles('SELLER')
@RequireMultiVendor()
@Controller('seller/questions')
export class SellerQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext, @Query() query: QuestionListQueryDto) {
    return this.questions.sellerList(user.id, query);
  }

  @Patch(':id/answer')
  @ResponseMessage('Answer published')
  answer(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: AnswerQuestionDto) {
    return this.questions.answer(user, id, dto.answer);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(@Query() query: QuestionListQueryDto) {
    return this.questions.adminList(query);
  }

  @Patch(':id/answer')
  @ResponseMessage('Answer published')
  answer(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: AnswerQuestionDto) {
    return this.questions.answer(user, id, dto.answer);
  }

  @Patch(':id')
  @ResponseMessage('Question updated')
  moderate(@Param('id') id: string, @Body() dto: ModerateQuestionDto) {
    return this.questions.moderate(id, dto.isVisible);
  }
}
