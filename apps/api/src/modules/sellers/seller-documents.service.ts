import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  type DocumentQueueRow,
  type ReviewSellerDocumentInput,
  SELLER_DOCUMENT_INFO,
  SELLER_DOCUMENT_TYPES,
  SELLER_DOCUMENT_UPLOAD,
  type SellerDocumentsView,
  type SellerDocumentType,
  type SellerDocumentView,
} from '@marketbd/shared';
import sharp from 'sharp';
import type { SellerDocument } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StorageService } from '../uploads/storage.service.js';

const REQUIRED = SELLER_DOCUMENT_TYPES.filter((t) => SELLER_DOCUMENT_INFO[t].required);

const toView = (d: SellerDocument): SellerDocumentView => ({
  id: d.id,
  type: d.type,
  mimeType: d.mimeType,
  fileName: d.fileName,
  status: d.status,
  note: d.note,
  reviewedAt: d.reviewedAt?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
});

export interface UploadedDocument {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size: number;
}

/** Identity and business documents a shop uploads so an admin can verify it. */
@Injectable()
export class SellerDocumentsService {
  private readonly logger = new Logger('SellerDocuments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Any seller profile of the user, approved or not: pending shops upload papers to get approved. */
  private async shopOf(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) throw new ForbiddenException('You do not have a seller account');
    return seller;
  }

  private async view(sellerId: string): Promise<SellerDocumentsView> {
    const [seller, docs] = await Promise.all([
      this.prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { verifiedAt: true } }),
      this.prisma.sellerDocument.findMany({ where: { sellerId } }),
    ]);
    if (!seller) throw new NotFoundException('Shop not found');
    const order = (t: SellerDocumentType) => SELLER_DOCUMENT_TYPES.indexOf(t);
    return {
      verifiedAt: seller.verifiedAt?.toISOString() ?? null,
      documents: docs.sort((a, b) => order(a.type) - order(b.type)).map(toView),
      missing: REQUIRED.filter((t) => !docs.some((d) => d.type === t && d.status !== 'REJECTED')),
    };
  }

  async mine(userId: string): Promise<SellerDocumentsView> {
    return this.view((await this.shopOf(userId)).id);
  }

  /** Stores the file in the private bucket. Images are re-encoded, which also drops EXIF/GPS data. */
  async upload(userId: string, type: SellerDocumentType, file: UploadedDocument | undefined): Promise<SellerDocumentsView> {
    const seller = await this.shopOf(userId);
    if (!file) throw new BadRequestException('Choose a file to upload');
    if (file.size > SELLER_DOCUMENT_UPLOAD.maxBytes) throw new BadRequestException('The file is larger than 5 MB');
    if (!(SELLER_DOCUMENT_UPLOAD.mimeTypes as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException('Upload a JPEG, PNG or WebP photo, or a PDF');
    }
    let body: Buffer;
    let mimeType: string;
    if (file.mimetype === 'application/pdf') {
      if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new BadRequestException('The file is not a valid PDF');
      body = file.buffer;
      mimeType = 'application/pdf';
    } else {
      try {
        body = await sharp(file.buffer).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      } catch {
        throw new BadRequestException('The file is not a valid image');
      }
      mimeType = 'image/jpeg';
    }
    const existing = await this.prisma.sellerDocument.findUnique({ where: { sellerId_type: { sellerId: seller.id, type } } });
    if (existing?.status === 'APPROVED' && seller.verifiedAt) {
      throw new BadRequestException('This document is approved and your shop is verified. Contact support to change it.');
    }
    const fileKey = `seller-documents/${seller.id}/${type.toLowerCase()}-${randomUUID()}.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`;
    await this.storage.putPrivate(fileKey, body, mimeType);
    const fileName = file.originalname?.slice(0, 120) ?? null;
    await this.prisma.sellerDocument.upsert({
      where: { sellerId_type: { sellerId: seller.id, type } },
      create: { sellerId: seller.id, type, fileKey, mimeType, fileName },
      update: { fileKey, mimeType, fileName, status: 'PENDING', note: null, reviewedAt: null, reviewedById: null },
    });
    if (existing) await this.storage.deletePrivate(existing.fileKey).catch((e: unknown) => this.logger.warn(`Old document not removed: ${String(e)}`));

    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await Promise.all(
      admins.map((a) =>
        this.notifications.notify(a.id, 'SELLER', 'Document to review', `${seller.shopName} uploaded: ${SELLER_DOCUMENT_INFO[type].label}.`, { sellerId: seller.id }),
      ),
    );
    return this.view(seller.id);
  }

  async remove(userId: string, id: string): Promise<SellerDocumentsView> {
    const seller = await this.shopOf(userId);
    const doc = await this.prisma.sellerDocument.findFirst({ where: { id, sellerId: seller.id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status === 'APPROVED') throw new BadRequestException('Approved documents cannot be removed');
    await this.prisma.sellerDocument.delete({ where: { id } });
    await this.storage.deletePrivate(doc.fileKey).catch(() => undefined);
    return this.view(seller.id);
  }

  /** The file, for the shop itself (userId) or an admin (sellerId). */
  async file(by: { userId: string } | { sellerId: string }, id: string): Promise<{ body: Buffer; doc: SellerDocument }> {
    const sellerId = 'sellerId' in by ? by.sellerId : (await this.shopOf(by.userId)).id;
    const doc = await this.prisma.sellerDocument.findFirst({ where: { id, sellerId } });
    if (!doc) throw new NotFoundException('Document not found');
    return { body: await this.storage.getPrivate(doc.fileKey), doc };
  }

  // ───── Admin ─────

  async queue(): Promise<DocumentQueueRow[]> {
    const groups = await this.prisma.sellerDocument.groupBy({
      by: ['sellerId'],
      where: { status: 'PENDING' },
      _count: true,
      _max: { updatedAt: true },
    });
    const shops = await this.prisma.sellerProfile.findMany({
      where: { id: { in: groups.map((g) => g.sellerId) } },
      select: { id: true, shopName: true, slug: true, verifiedAt: true },
    });
    return groups
      .map((g) => {
        const s = shops.find((x) => x.id === g.sellerId)!;
        return { sellerId: s.id, shopName: s.shopName, slug: s.slug, verifiedAt: s.verifiedAt?.toISOString() ?? null, pending: g._count, lastUploadAt: g._max.updatedAt!.toISOString() };
      })
      .sort((a, b) => a.lastUploadAt.localeCompare(b.lastUploadAt));
  }

  adminView(sellerId: string): Promise<SellerDocumentsView> {
    return this.view(sellerId);
  }

  async review(adminId: string, sellerId: string, id: string, input: ReviewSellerDocumentInput): Promise<SellerDocumentsView> {
    const doc = await this.prisma.sellerDocument.findFirst({ where: { id, sellerId }, include: { seller: { select: { userId: true, verifiedAt: true } } } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.sellerDocument.update({
      where: { id },
      data: { status: input.status, note: input.status === 'REJECTED' ? (input.note ?? null) : null, reviewedAt: new Date(), reviewedById: adminId },
    });
    const label = SELLER_DOCUMENT_INFO[doc.type].label;
    // A rejected required document takes the badge away until it is fixed.
    if (input.status === 'REJECTED' && doc.seller.verifiedAt && SELLER_DOCUMENT_INFO[doc.type].required) {
      await this.prisma.sellerProfile.update({ where: { id: sellerId }, data: { verifiedAt: null } });
    }
    await this.notifications.notify(
      doc.seller.userId,
      'SELLER',
      input.status === 'APPROVED' ? 'Document approved' : 'Document needs another look',
      input.status === 'APPROVED' ? `${label} was approved.` : `${label} was not accepted: ${input.note}. Please upload it again.`,
      { documentId: id },
    );
    return this.view(sellerId);
  }

  async setVerified(sellerId: string, verified: boolean): Promise<SellerDocumentsView> {
    const seller = await this.prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { userId: true, verifiedAt: true } });
    if (!seller) throw new NotFoundException('Shop not found');
    if (verified) {
      const approved = await this.prisma.sellerDocument.findMany({ where: { sellerId, status: 'APPROVED' }, select: { type: true } });
      const missing = REQUIRED.filter((t) => !approved.some((d) => d.type === t));
      if (missing.length) {
        throw new BadRequestException(`Approve these documents first: ${missing.map((t) => SELLER_DOCUMENT_INFO[t].label).join(', ')}`);
      }
    }
    await this.prisma.sellerProfile.update({ where: { id: sellerId }, data: { verifiedAt: verified ? (seller.verifiedAt ?? new Date()) : null } });
    if (verified && !seller.verifiedAt) {
      await this.notifications.notify(seller.userId, 'SELLER', 'Your shop is verified', 'Shoppers now see a “Verified seller” badge on your shop and products.');
    }
    return this.view(sellerId);
  }
}
