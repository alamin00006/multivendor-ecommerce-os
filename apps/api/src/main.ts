import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { API_PREFIX, setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  setupApp(app);
  await app.listen(env.PORT);
  Logger.log(`API ready on ${env.API_PUBLIC_URL}/${API_PREFIX} — docs at ${env.API_PUBLIC_URL}/docs`, 'Bootstrap');
}

await bootstrap();
