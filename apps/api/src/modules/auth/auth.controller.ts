import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AUTH,
  type AuthResult,
  LoginSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RefreshSchema,
  RegisterSchema,
} from '@marketbd/shared';
import type { CookieOptions, Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { isProduction } from '../../config/env.js';
import { Public, ResponseMessage } from '../../common/decorators.js';
import { AuthService } from './auth.service.js';
import type { ClientInfo } from './token.service.js';

class RegisterDto extends createZodDto(RegisterSchema) {}
class LoginDto extends createZodDto(LoginSchema) {}
class OtpRequestDto extends createZodDto(OtpRequestSchema) {}
class OtpVerifyDto extends createZodDto(OtpVerifySchema) {}
class RefreshDto extends createZodDto(RefreshSchema) {}

export const REFRESH_COOKIE = 'mbd_rt';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: AUTH.refreshTokenTtlSeconds * 1000,
};

const STRICT = { default: { limit: 5, ttl: 60_000 } };

const clientInfo = (req: Request): ClientInfo => ({ userAgent: req.headers['user-agent'], ip: req.ip });

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Web clients get the refresh token as an httpOnly cookie; mobile reads it from the body. */
  private withCookie(res: Response, result: AuthResult): AuthResult {
    res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, cookieOptions);
    return result;
  }

  @Throttle(STRICT)
  @Post('register')
  @ResponseMessage('Account created')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.register(dto, clientInfo(req)));
  }

  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  @ResponseMessage('Signed in')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.login(dto, clientInfo(req)));
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(200)
  @ResponseMessage('Verification code sent')
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Throttle(STRICT)
  @Post('otp/verify')
  @HttpCode(200)
  @ResponseMessage('Signed in')
  async verifyOtp(@Body() dto: OtpVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.verifyOtp(dto, clientInfo(req)));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = dto.refreshToken ?? (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No session. Please sign in.');
    return this.withCookie(res, await this.auth.refresh(token, clientInfo(req)));
  }

  @Post('logout')
  @HttpCode(200)
  @ResponseMessage('Signed out')
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = dto.refreshToken ?? (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    return null;
  }
}
