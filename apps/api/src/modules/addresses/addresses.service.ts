import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AddressPayload, AddressView, AreaOption, GeoOption, UpdateAddressPayload } from '@marketbd/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const addressInclude = {
  division: true,
  district: true,
  area: true,
} satisfies Prisma.AddressInclude;

export type AddressWithGeo = Prisma.AddressGetPayload<{ include: typeof addressInclude }>;

export const toAddressView = (a: AddressWithGeo): AddressView => ({
  id: a.id,
  label: a.label,
  fullName: a.fullName,
  phone: a.phone,
  division: { id: a.division.id, name: a.division.name, nameBn: a.division.nameBn },
  district: { id: a.district.id, name: a.district.name, nameBn: a.district.nameBn },
  area: {
    id: a.area.id,
    name: a.area.name,
    nameBn: a.area.nameBn,
    districtId: a.area.districtId,
    isInsideDhaka: a.area.isInsideDhaka,
  },
  addressLine: a.addressLine,
  landmark: a.landmark,
  isDefault: a.isDefault,
  shippingZone: a.area.isInsideDhaka ? 'INSIDE_DHAKA' : 'OUTSIDE_DHAKA',
});

const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  // ───── Geo lookups ─────

  divisions(): Promise<GeoOption[]> {
    return this.prisma.division.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, nameBn: true } });
  }

  districts(divisionId: number): Promise<GeoOption[]> {
    return this.prisma.district.findMany({
      where: { divisionId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nameBn: true },
    });
  }

  areas(districtId: number): Promise<AreaOption[]> {
    return this.prisma.area.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nameBn: true, districtId: true, isInsideDhaka: true },
    });
  }

  // ───── Address book ─────

  async list(userId: string): Promise<AddressView[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      include: addressInclude,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toAddressView);
  }

  async findOwned(userId: string, id: string): Promise<AddressWithGeo> {
    const address = await this.prisma.address.findFirst({ where: { id, userId }, include: addressInclude });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  private async assertGeo(divisionId: number, districtId: number, areaId: number): Promise<void> {
    const area = await this.prisma.area.findUnique({ where: { id: areaId }, include: { district: true } });
    if (!area || area.districtId !== districtId || area.district.divisionId !== divisionId) {
      throw new BadRequestException('Division, district and area do not match');
    }
  }

  async create(userId: string, input: AddressPayload): Promise<AddressView> {
    await this.assertGeo(input.divisionId, input.districtId, input.areaId);
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new BadRequestException(`You can save up to ${MAX_ADDRESSES} addresses`);
    const isDefault = input.isDefault || count === 0;

    const address = await this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...input, userId, isDefault }, include: addressInclude });
    });
    return toAddressView(address);
  }

  async update(userId: string, id: string, input: UpdateAddressPayload): Promise<AddressView> {
    const current = await this.findOwned(userId, id);
    const divisionId = input.divisionId ?? current.divisionId;
    const districtId = input.districtId ?? current.districtId;
    const areaId = input.areaId ?? current.areaId;
    if (input.divisionId || input.districtId || input.areaId) {
      await this.assertGeo(Number(divisionId), Number(districtId), Number(areaId));
    }
    const address = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({
        where: { id },
        data: {
          ...input,
          divisionId: Number(divisionId),
          districtId: Number(districtId),
          areaId: Number(areaId),
        },
        include: addressInclude,
      });
    });
    return toAddressView(address);
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.findOwned(userId, id);
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}
