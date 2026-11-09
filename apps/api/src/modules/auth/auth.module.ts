import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ConsoleOtpSender, HttpSmsOtpSender, OtpSender } from './otp-sender.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  imports: [JwtModule.register({ secret: env.JWT_ACCESS_SECRET })],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    { provide: OtpSender, useClass: env.OTP_PROVIDER === 'sms' ? HttpSmsOtpSender : ConsoleOtpSender },
  ],
  exports: [JwtModule, TokenService],
})
export class AuthModule {}
