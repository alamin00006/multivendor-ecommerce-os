import {
  type CallHandler,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  type NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { adminAreaFor, type AdminRouteArea, hasAdminArea } from '@marketbd/shared';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUserContext } from './auth-user.js';
import { RESPONSE_MESSAGE_KEY } from './decorators.js';

type AdminRequest = Request & { user?: AuthUserContext; adminArea?: AdminRouteArea };

/** `/api/v1/admin/orders/x` → `orders/x`; null when the path is not an admin route. */
export function adminSubPath(path: string): string | null {
  const m = /^\/api\/v\d+\/admin(?:\/(.*))?$/.exec(path);
  return m ? (m[1] ?? '') : null;
}

/**
 * Global guard (after RolesGuard): admin staff may only use the `/admin/...` routes of the areas
 * they hold. Permissions are read from the database on every admin request, so a change or a
 * disabled account takes effect at once.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AdminRequest>();
    if (req.user?.role !== 'ADMIN') return true;
    const sub = adminSubPath(req.path);
    const account = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isActive: true, adminPermissions: true },
    });
    if (!account?.isActive) throw new UnauthorizedException('This account is disabled');
    if (sub === null) return true;
    const area = adminAreaFor(sub);
    req.adminArea = area;
    // Every staff member may read the store settings (store name, currency, brand) the panel needs.
    if (area === 'settings' && req.method === 'GET') return true;
    if (!hasAdminArea(account.adminPermissions, area)) {
      throw new ForbiddenException('Your staff account does not have access to this section');
    }
    return true;
  }
}

const SECRET_KEY = /pass(word)?|secret|token|credential|api[-_]?key|^key$|otp|pin$/i;
const MAX_DETAILS = 4000;

/** Copy of a request body without secrets, cut down to a reasonable size. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (depth > 4) return '…';
  if (Array.isArray(value)) {
    const items = value.slice(0, 25).map((v) => redact(v, depth + 1));
    return value.length > 25 ? [...items, `… ${value.length - 25} more`] : items;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[hidden]' : redact(v, depth + 1)]),
  );
}

/** Global interceptor: records every successful change an admin makes. */
@Injectable()
export class AdminActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AdminActivity');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const sub = adminSubPath(req.path);
    if (req.user?.role !== 'ADMIN' || req.method === 'GET' || sub === null) return next.handle();
    const summary = this.reflector.getAllAndOverride<string | undefined>(RESPONSE_MESSAGE_KEY, [context.getHandler(), context.getClass()]);
    const actorId = req.user.id;
    return next.handle().pipe(
      tap(() => {
        let details = redact(req.body ?? null);
        if (details && JSON.stringify(details).length > MAX_DETAILS) details = { note: 'Too large to keep' };
        this.prisma.adminActivity
          .create({
            data: {
              actorId,
              method: req.method,
              path: req.path.replace(/^\/api\/v\d+/, ''),
              area: req.adminArea ?? adminAreaFor(sub),
              summary: summary ?? null,
              details: details === null || (typeof details === 'object' && !Object.keys(details).length) ? undefined : (details as object),
              ip: req.ip ?? null,
            },
          })
          .catch((e: unknown) => this.logger.warn(`Could not record admin activity: ${String(e)}`));
      }),
    );
  }
}
