import { Controller, Get, Module, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ImageResizeQuerySchema } from '@marketbd/shared';
import type { Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { Public } from '../../common/decorators.js';
import { ImagesService } from './images.service.js';

class ImageResizeQueryDto extends createZodDto(ImageResizeQuerySchema) {}

@ApiTags('images')
@Public()
@SkipThrottle()
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  /** GET /images/resize?url=&width= — resized, cacheable image bytes. */
  @Get('resize')
  async resize(@Query() query: ImageResizeQueryDto, @Req() req: Request, @Res() res: Response) {
    const image = await this.images.resize(query.url, query.width, query.quality, query.format);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', image.etag);
    res.setHeader('Vary', 'Accept');
    if (req.headers['if-none-match'] === image.etag) {
      res.status(304).end();
      return;
    }
    res.type(image.contentType).send(image.body);
  }
}

@Module({
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
