import type { z } from 'zod';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ActivityListQuerySchema,
  type ActivityView,
  type CreateStaffPayload,
  FULL_ADMIN_ACCESS,
  type StaffView,
  type UpdateStaffPayload,
} from '@marketbd/shared';
import argon2 from 'argon2';
import type { Prisma } from '../../generated/prisma/client.js';
import { PaginatedResult, skipTake } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import { AdminService } from './admin.service.js';

type ActivityQuery = z.infer<typeof ActivityListQuerySchema>;

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  adminPermissions: true,
  createdAt: true,
  adminActivities: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

const toStaff = (u: StaffRow): StaffView => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  isActive: u.isActive,
  permissions: u.adminPermissions,
  lastActivityAt: u.adminActivities[0]?.createdAt.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

/** Admin staff accounts and the admin activity log (full-access admins only; see AdminAccessGuard). */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly admin: AdminService,
  ) {}

  async list(): Promise<StaffView[]> {
    const rows = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: staffSelect, orderBy: { createdAt: 'asc' } });
    return rows.map(toStaff);
  }

  async create(input: CreateStaffPayload): Promise<StaffView> {
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
      select: { email: true },
    });
    if (taken) {
      throw new ConflictException(
        taken.email === input.email
          ? 'An account with this email already exists. Make it an admin from the Users page instead.'
          : 'This phone number is already registered',
      );
    }
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash: await argon2.hash(input.password),
        role: 'ADMIN',
        adminPermissions: input.permissions,
        emailVerifiedAt: new Date(),
      },
      select: staffSelect,
    });
    return toStaff(user);
  }

  async update(actorId: string, id: string, input: UpdateStaffPayload): Promise<StaffView> {
    const target = await this.prisma.user.findFirst({ where: { id, role: 'ADMIN' }, select: { adminPermissions: true } });
    if (!target) throw new NotFoundException('Staff member not found');
    const losesOwner =
      target.adminPermissions.includes(FULL_ADMIN_ACCESS) &&
      (input.isActive === false || (input.permissions && !input.permissions.includes(FULL_ADMIN_ACCESS)));
    if (id === actorId && losesOwner) throw new BadRequestException('You cannot remove your own full access or disable yourself');
    if (losesOwner) await this.admin.assertAnotherOwner(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...(input.permissions ? { adminPermissions: input.permissions } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
      select: staffSelect,
    });
    if (input.isActive === false) await this.tokens.revokeAllForUser(id);
    return toStaff(user);
  }

  async activity(query: ActivityQuery): Promise<PaginatedResult<ActivityView>> {
    const where: Prisma.AdminActivityWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.area ? { area: query.area } : {}),
      ...(query.q
        ? { OR: [{ path: { contains: query.q, mode: 'insensitive' } }, { summary: { contains: query.q, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.adminActivity.findMany({
        where,
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(query.page, query.limit),
      }),
      this.prisma.adminActivity.count({ where }),
    ]);
    const items: ActivityView[] = rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      method: r.method,
      path: r.path,
      area: r.area,
      summary: r.summary,
      details: r.details,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));
    return PaginatedResult.of(items, query.page, query.limit, total);
  }
}
