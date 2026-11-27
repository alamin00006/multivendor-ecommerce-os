import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReviewSellerDocumentSchema, SELLER_DOCUMENT_UPLOAD, SellerDocumentUploadQuerySchema, SellerVerificationSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, RequireMultiVendor, ResponseMessage, Roles } from '../../common/decorators.js';
import type { SellerDocument } from '../../generated/prisma/client.js';
import { SellerDocumentsService } from './seller-documents.service.js';

class UploadQueryDto extends createZodDto(SellerDocumentUploadQuerySchema) {}
class ReviewDto extends createZodDto(ReviewSellerDocumentSchema) {}
class VerificationDto extends createZodDto(SellerVerificationSchema) {}

const asFile = ({ body, doc }: { body: Buffer; doc: SellerDocument }) =>
  new StreamableFile(body, {
    type: doc.mimeType,
    disposition: `inline; filename="${doc.type.toLowerCase()}.${doc.mimeType === 'application/pdf' ? 'pdf' : 'jpg'}"`,
    length: body.length,
  });

/**
 * The shop's own verification documents. Open to applicants too (they are still customers
 * until approved), so access is checked against the user's seller profile, not the role.
 */
@ApiTags('sellers')
@ApiBearerAuth()
@RequireMultiVendor()
@Controller('sellers/me/documents')
export class SellerDocumentsController {
  constructor(private readonly documents: SellerDocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext) {
    return this.documents.mine(user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ResponseMessage('Document uploaded. We will review it soon.')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SELLER_DOCUMENT_UPLOAD.maxBytes, files: 1 } }))
  upload(@CurrentUser() user: AuthUserContext, @Query() query: UploadQueryDto, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.documents.upload(user.id, query.type, file);
  }

  @Get(':id/file')
  async file(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return asFile(await this.documents.file({ userId: user.id }, id));
  }

  @Delete(':id')
  @ResponseMessage('Document removed')
  remove(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.documents.remove(user.id, id);
  }
}

/** Admin review of shop documents (Sellers area). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@RequireMultiVendor()
@Controller('admin/seller-documents')
export class AdminSellerDocumentsController {
  constructor(private readonly documents: SellerDocumentsService) {}

  @Get()
  queue() {
    return this.documents.queue();
  }

  @Get(':sellerId')
  list(@Param('sellerId') sellerId: string) {
    return this.documents.adminView(sellerId);
  }

  @Get(':sellerId/:id/file')
  async file(@Param('sellerId') sellerId: string, @Param('id') id: string) {
    return asFile(await this.documents.file({ sellerId }, id));
  }

  @Patch(':sellerId/:id')
  @ResponseMessage('Document reviewed')
  review(@CurrentUser() user: AuthUserContext, @Param('sellerId') sellerId: string, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.documents.review(user.id, sellerId, id, dto);
  }

  @Put(':sellerId/verification')
  @ResponseMessage('Shop verification updated')
  verify(@Param('sellerId') sellerId: string, @Body() dto: VerificationDto) {
    return this.documents.setVerified(sellerId, dto.verified);
  }
}
