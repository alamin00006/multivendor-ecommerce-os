import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BRAND } from '@marketbd/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { env } from './config/env.js';

export const API_PREFIX = 'api/v1';

/** Shared bootstrap used by main.ts and e2e tests. */
export function setupApp(app: NestExpressApplication): INestApplication {
  app.set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX, { exclude: ['docs', 'docs/(.*)'] });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true,
    credentials: true,
  });
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle(`${BRAND.name} API`)
    .setDescription(`REST API for the ${BRAND.name} marketplace (web, mobile, seller and admin panels).`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));
  return app;
}
