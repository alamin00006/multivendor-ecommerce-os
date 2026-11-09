import type { Role } from '@marketbd/shared';

/** Identity attached to `request.user` by the JWT guard. */
export interface AuthUserContext {
  id: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}
