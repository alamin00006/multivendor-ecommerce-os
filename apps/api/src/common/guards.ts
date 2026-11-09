import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@marketbd/shared';
import type { Request } from 'express';
import { env } from '../config/env.js';
import { PlatformModeService } from '../modules/platform/platform-mode.service.js';
import type { AccessTokenPayload, AuthUserContext } from './auth-user.js';
import { IS_PUBLIC_KEY, REQUIRE_MULTI_VENDOR_KEY, ROLES_KEY } from './decorators.js';

type AuthedRequest = Request & { user?: AuthUserContext };

const bearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

/** Global guard: verifies the access token; public routes accept an optional token. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: env.JWT_ACCESS_SECRET });
      req.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
  }
}

/** Global guard: enforces @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new UnauthorizedException('Authentication required');
    if (!roles.includes(user.role)) throw new ForbiddenException('You do not have access to this resource');
    return true;
  }
}

/** Global guard: blocks @RequireMultiVendor() routes when multi-vendor mode is off. */
@Injectable()
export class MultiVendorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly mode: PlatformModeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_MULTI_VENDOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    await this.mode.assertMultiVendor();
    return true;
  }
}
