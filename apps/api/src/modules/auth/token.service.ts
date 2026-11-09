import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH, type AuthTokens, type Role } from '@marketbd/shared';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../../common/auth-user.js';

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

const hashToken = (token: string) => createHash('sha256').update(`${token}.${env.JWT_REFRESH_SECRET}`).digest('hex');

/**
 * Issues short-lived JWT access tokens and opaque, rotating refresh tokens.
 * Refresh tokens are stored hashed; reusing a rotated token revokes the whole family.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(
    user: { id: string; role: Role },
    client: ClientInfo,
    familyId: string = randomUUID(),
  ): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: AUTH.accessTokenTtlSeconds,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + AUTH.refreshTokenTtlSeconds * 1000),
        userAgent: client.userAgent?.slice(0, 255),
        ip: client.ip,
      },
    });
    return { accessToken, refreshToken, accessTokenExpiresIn: AUTH.accessTokenTtlSeconds };
  }

  /** Validates and rotates a refresh token. Returns the user id and the new token pair. */
  async rotate(refreshToken: string, client: ClientInfo): Promise<{ userId: string; tokens: AuthTokens }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { id: true, role: true, isActive: true } } },
    });
    if (!record) throw new UnauthorizedException('Invalid session. Please sign in again.');

    if (record.revokedAt) {
      // Token reuse: someone replayed an already-rotated token. Kill the whole session family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session was revoked. Please sign in again.');
    }
    if (record.expiresAt < new Date() || !record.user.isActive) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const tokens = await this.issue(record.user, client, record.familyId);
    const next = await this.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(tokens.refreshToken) },
    });
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: next.id },
    });
    if (count === 0) {
      // Lost a race with a concurrent refresh of the same token.
      await this.prisma.refreshToken.delete({ where: { id: next.id } });
      throw new UnauthorizedException('Session was refreshed elsewhere. Please retry.');
    }
    return { userId: record.user.id, tokens };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
