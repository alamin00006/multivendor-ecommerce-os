import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser, ChangePasswordInput, UpdateProfileInput } from '@marketbd/shared';
import argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import { authUserInclude, toAuthUser } from './user.mapper.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: authUserInclude });
    return toAuthUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: input, include: authUserInclude });
    return toAuthUser(user);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash) {
      const valid = await argon2.verify(user.passwordHash, input.currentPassword);
      if (!valid) throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(input.newPassword) },
    });
    await this.tokens.revokeAllForUser(userId);
  }
}
