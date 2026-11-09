import type { AuthUser } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const authUserInclude = {
  sellerProfile: { select: { id: true, shopName: true, slug: true, status: true, isHouseStore: true } },
} satisfies Prisma.UserInclude;

export type UserWithSeller = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

export const toAuthUser = (user: UserWithSeller): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatarUrl: user.avatarUrl,
  locale: user.locale,
  sellerProfile: user.sellerProfile,
  createdAt: user.createdAt.toISOString(),
});
