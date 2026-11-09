import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AUTH, type OtpPurpose, type OtpRequestResult } from '@marketbd/shared';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OtpSender } from './otp-sender.js';

const MAX_PER_HOUR = 5;

const hashCode = (phone: string, code: string) =>
  createHmac('sha256', env.JWT_REFRESH_SECRET).update(`${phone}:${code}`).digest('hex');

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: OtpSender,
  ) {}

  async request(phone: string, purpose: OtpPurpose): Promise<OtpRequestResult> {
    const now = Date.now();
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, purpose, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last) {
      const waitMs = last.createdAt.getTime() + AUTH.otpResendCooldownSeconds * 1000 - now;
      if (waitMs > 0) {
        throw new HttpException(
          `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    if (recent.length >= MAX_PER_HOUR) {
      throw new HttpException('Too many codes requested. Try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 10 ** AUTH.otpLength)).padStart(AUTH.otpLength, '0');
    await this.prisma.otpCode.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.otpCode.create({
      data: { phone, purpose, codeHash: hashCode(phone, code), expiresAt: new Date(now + AUTH.otpTtlSeconds * 1000) },
    });
    await this.sender.send(phone, code);
    return { expiresIn: AUTH.otpTtlSeconds, resendIn: AUTH.otpResendCooldownSeconds };
  }

  /** Verifies and consumes the latest code for this phone. Throws on mismatch. */
  async verify(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('The code has expired. Please request a new one.');
    }
    if (otp.attempts >= AUTH.otpMaxAttempts) {
      throw new BadRequestException('Too many wrong attempts. Please request a new code.');
    }
    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(hashCode(phone, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Incorrect code. Please try again.');
    }
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw new BadRequestException('The code has already been used.');
  }
}
