import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CropZoneSuitability as PrismaSuit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropZoneSuitabilityRepository } from '../../application/zone/crop-zone-suitability.repository';
import { CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';

@Injectable()
export class PrismaCropZoneSuitabilityRepository implements CropZoneSuitabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(s: CropZoneSuitabilitySnapshot): Promise<void> {
    await this.prisma.cropZoneSuitability.upsert({
      where: { cropId_zoneId: { cropId: s.cropId, zoneId: s.zoneId } },
      create: this.toRow(s), update: this.toRow(s),
    });
  }

  async listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    const rows = await this.prisma.cropZoneSuitability.findMany({ where: { cropId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    const rows = await this.prisma.cropZoneSuitability.findMany({ where: { zoneId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async replaceForCrop(cropId: string, items: CropZoneSuitabilitySnapshot[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cropZoneSuitability.deleteMany({ where: { cropId } }),
      ...items.map((s) => this.prisma.cropZoneSuitability.create({ data: this.toRow(s) })),
    ]);
  }

  private toRow(s: CropZoneSuitabilitySnapshot) {
    return {
      cropId: s.cropId,
      zoneId: s.zoneId,
      rating: s.rating,
      justification: s.justification ?? null,
      provenance: (s.provenance ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaSuit): CropZoneSuitabilitySnapshot {
    return {
      cropId: row.cropId,
      zoneId: row.zoneId,
      rating: row.rating as SuitabilityRating,
      justification: row.justification ?? undefined,
      provenance: (row.provenance ?? undefined) as CropZoneSuitabilitySnapshot['provenance'],
    };
  }
}
