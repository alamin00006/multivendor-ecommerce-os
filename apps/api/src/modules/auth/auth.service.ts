import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthResult, LoginInput, OtpRequestResult, OtpVerifyInput, RegisterInput } from '@marketbd/shared';
import argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { authUserInclude, toAuthUser } from '../users/user.mapper.js';
import { OtpService } from './otp.service.js';
import { type ClientInfo, TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
  ) {}

  async register(input: RegisterInput, client: ClientInfo): Promise<AuthResult> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
      select: { email: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === input.email
          ? 'An account with this email already exists'
          : 'This phone number is already registered',
      );
    }
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await argon2.hash(input.password),
      },
      include: authUserInclude,
    });
    return { user: toAuthUser(user), tokens: await this.tokens.issue(user, client) };
  }

  async login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email }, include: authUserInclude });
    const valid = user?.passwordHash ? await argon2.verify(user.passwordHash, input.password) : false;
    if (!user || !valid) throw new UnauthorizedException('Incorrect email or password');
    if (!user.isActive) throw new ForbiddenException('This account has been disabled. Contact support.');
    return { user: toAuthUser(user), tokens: await this.tokens.issue(user, client) };
  }

  requestOtp(phone: string): Promise<OtpRequestResult> {
    return this.otp.request(phone, 'LOGIN');
  }

  /** Phone OTP login. Creates a customer account on first sign-in. */
  async verifyOtp(input: OtpVerifyInput, client: ClientInfo): Promise<AuthResult> {
    await this.otp.verify(input.phone, input.code, 'LOGIN');
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone }, include: authUserInclude });
    if (existing && !existing.isActive)
      throw new ForbiddenException('This account has been disabled. Contact support.');

    const user =
      existing ??
      (await this.prisma.user.create({
        data: {
          phone: input.phone,
          name: input.name ?? `Customer ${input.phone.slice(-4)}`,
          phoneVerifiedAt: new Date(),
        },
        include: authUserInclude,
      }));
    if (existing && !existing.phoneVerifiedAt) {
      await this.prisma.user.update({ where: { id: existing.id }, data: { phoneVerifiedAt: new Date() } });
    }
    return { user: toAuthUser(user), tokens: await this.tokens.issue(user, client) };
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthResult> {
    const { userId, tokens } = await this.tokens.rotate(refreshToken, client);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: authUserInclude });
    return { user: toAuthUser(user), tokens };
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
