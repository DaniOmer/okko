import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropDocument } from '../../application/crop/crop-read-model';
import { PublishedCropRecord, PublishedCropRepository } from '../../application/crop/published-crop.repository';

@Injectable()
export class PrismaPublishedCropRepository implements PublishedCropRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(r: PublishedCropRecord): Promise<void> {
    const data = {
      document: r.document as unknown as Prisma.InputJsonValue,
      version: r.version,
      publishedAt: new Date(r.publishedAt),
      publishedBy: r.publishedBy,
    };
    await this.prisma.publishedCrop.upsert({
      where: { cropId: r.cropId },
      create: { cropId: r.cropId, ...data },
      update: data,
    });
  }

  async findByCrop(cropId: string): Promise<PublishedCropRecord | null> {
    const row = await this.prisma.publishedCrop.findUnique({ where: { cropId } });
    if (!row) return null;
    return {
      cropId: row.cropId,
      document: row.document as unknown as CropDocument,
      version: row.version,
      publishedAt: row.publishedAt.toISOString(),
      publishedBy: row.publishedBy,
    };
  }
}
