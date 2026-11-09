import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { OtpSender } from '../src/modules/auth/otp-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

/** Captures OTP codes instead of sending SMS so tests can complete the login. */
export class CapturingOtpSender extends OtpSender {
  readonly codes = new Map<string, string>();
  send(phone: string, code: string): Promise<void> {
    this.codes.set(phone, code);
    return Promise.resolve();
  }
}

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  otp: CapturingOtpSender;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const otp = new CapturingOtpSender();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OtpSender)
    .useValue(otp)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  setupApp(app);
  await app.init();
  return {
    app: app as unknown as INestApplication<App>,
    prisma: app.get(PrismaService),
    otp,
    http: () => request(app.getHttpServer() as App),
  };
}

export const API = '/api/v1';

export async function login(ctx: TestContext, email: string, password: string): Promise<string> {
  const res = await ctx.http().post(`${API}/auth/login`).send({ email, password }).expect(200);
  return (res.body as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
}

export async function setMultiVendor(ctx: TestContext, adminToken: string, enabled: boolean): Promise<void> {
  await ctx
    .http()
    .patch(`${API}/admin/settings`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ multiVendorEnabled: enabled })
    .expect(200);
}
