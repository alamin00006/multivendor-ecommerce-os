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
  birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
  gender: user.gender,
  emailVerified: Boolean(user.emailVerifiedAt),
  phoneVerified: Boolean(user.phoneVerifiedAt),
  adminPermissions: user.role === 'ADMIN' ? user.adminPermissions : [],
  createdAt: user.createdAt.toISOString(),
});
