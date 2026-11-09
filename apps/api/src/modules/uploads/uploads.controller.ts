/// <reference types="multer" />
import { BadRequestException, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UPLOADS, UploadFolderSchema, type UploadResult } from '@marketbd/shared';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage } from '../../common/decorators.js';
import { StorageService } from './storage.service.js';

class UploadQueryDto extends createZodDto(UploadFolderSchema) {}

const ADMIN_FOLDERS = new Set(['categories', 'brands', 'banners', 'campaigns']);
const SELLER_FOLDERS = new Set(['products', 'shops']);

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Uploads one image. It is re-encoded to WebP (max 2000px) which strips EXIF metadata
   * and guarantees the stored file really is an image.
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ResponseMessage('Image uploaded')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOADS.maxImageBytes, files: 1 } }))
  async image(
    @CurrentUser() user: AuthUserContext,
    @Query() query: UploadQueryDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('Choose an image to upload');
    if (!(UPLOADS.allowedImageMimeTypes as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP or AVIF images are allowed');
    }
    if (ADMIN_FOLDERS.has(query.folder) && user.role !== 'ADMIN') {
      throw new BadRequestException('You cannot upload to this folder');
    }
    if (SELLER_FOLDERS.has(query.folder) && user.role === 'CUSTOMER') {
      throw new BadRequestException('You cannot upload to this folder');
    }
    let body: Buffer;
    try {
      body = await sharp(file.buffer)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('The file is not a valid image');
    }
    const now = new Date();
    const key = `${query.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.webp`;
    const url = await this.storage.put(key, body, 'image/webp');
    return { key, url };
  }
}
