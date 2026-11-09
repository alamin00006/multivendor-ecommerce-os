import { createParamDecorator, type ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { Role } from '@marketbd/shared';
import type { Request } from 'express';
import type { AuthUserContext } from './auth-user.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const REQUIRE_MULTI_VENDOR_KEY = 'requireMultiVendor';
export const RESPONSE_MESSAGE_KEY = 'responseMessage';

/** Route is reachable without a token. A valid token, if sent, is still attached to the request. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict a route or controller to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Block the route with 403 when the platform runs in single-vendor mode. */
export const RequireMultiVendor = () => SetMetadata(REQUIRE_MULTI_VENDOR_KEY, true);

/** Message placed in the `{ success, data, message }` envelope. */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

type RequestWithUser = Request & { user?: AuthUserContext };

/** The authenticated user. Throws 401 when used on a public route without a token. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUserContext => {
  const user = ctx.switchToHttp().getRequest<RequestWithUser>().user;
  if (!user) throw new UnauthorizedException('Authentication required');
  return user;
});

/** The authenticated user, or null on public routes. */
export const OptionalUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUserContext | null =>
    ctx.switchToHttp().getRequest<RequestWithUser>().user ?? null,
);
