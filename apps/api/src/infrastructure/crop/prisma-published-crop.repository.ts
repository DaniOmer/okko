import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropDocument } from '../../application/crop/crop-read-model';
import { PublishedCropRecord, PublishedCropRepository, PublishedCropVersion } from '../../application/crop/published-crop.repository';

@Injectable()
export class PrismaPublishedCropRepository implements PublishedCropRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(r: PublishedCropRecord): Promise<void> {
    await this.prisma.publishedCrop.create({
      data: {
        cropId: r.cropId,
        revision: r.revision,
        document: r.document as unknown as Prisma.InputJsonValue,
        version: r.version,
        publishedAt: new Date(r.publishedAt),
        publishedBy: r.publishedBy,
      },
    });
  }

  async findLatest(cropId: string): Promise<PublishedCropRecord | null> {
    const row = await this.prisma.publishedCrop.findFirst({ where: { cropId }, orderBy: { revision: 'desc' } });
    return row ? this.toRecord(row) : null;
  }

  async findRevision(cropId: string, revision: number): Promise<PublishedCropRecord | null> {
    const row = await this.prisma.publishedCrop.findUnique({ where: { cropId_revision: { cropId, revision } } });
    return row ? this.toRecord(row) : null;
  }

  async listByCrop(cropId: string): Promise<PublishedCropVersion[]> {
    const rows = await this.prisma.publishedCrop.findMany({
      where: { cropId },
      orderBy: { revision: 'desc' },
      select: { revision: true, version: true, publishedAt: true, publishedBy: true },
    });
    return rows.map((r) => ({ revision: r.revision, version: r.version, publishedAt: r.publishedAt.toISOString(), publishedBy: r.publishedBy }));
  }

  private toRecord(row: { cropId: string; revision: number; document: unknown; version: number; publishedAt: Date; publishedBy: string }): PublishedCropRecord {
    return {
      cropId: row.cropId,
      revision: row.revision,
      document: row.document as unknown as CropDocument,
      version: row.version,
      publishedAt: row.publishedAt.toISOString(),
      publishedBy: row.publishedBy,
    };
  }
}
