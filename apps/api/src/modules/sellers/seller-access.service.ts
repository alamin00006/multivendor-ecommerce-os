import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { SellerProfile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Resolves which seller profile the current user acts as. */
@Injectable()
export class SellerAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The approved seller profile of a seller-panel user. */
  async requireActiveSeller(userId: string): Promise<SellerProfile> {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) throw new ForbiddenException('You do not have a seller account');
    if (seller.status === 'PENDING') throw new ForbiddenException('Your shop is awaiting admin approval');
    if (seller.status === 'SUSPENDED') throw new ForbiddenException('Your shop has been suspended. Contact support.');
    return seller;
  }

  async houseStore(): Promise<SellerProfile> {
    const house = await this.prisma.sellerProfile.findFirst({ where: { isHouseStore: true } });
    if (!house) throw new InternalServerErrorException('House store is missing. Run the database seed.');
    return house;
  }
}
