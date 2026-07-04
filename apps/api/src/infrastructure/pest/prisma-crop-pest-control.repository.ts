import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CropPestControl as PrismaControl } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropPestControlRepository } from '../../application/pest/crop-pest-control.repository';
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';

@Injectable()
export class PrismaCropPestControlRepository implements CropPestControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(c: CropPestControlSnapshot): Promise<void> {
    await this.prisma.cropPestControl.upsert({
      where: { cropId_pestId: { cropId: c.cropId, pestId: c.pestId } },
      create: this.toRow(c), update: this.toRow(c),
    });
  }

  async listByCrop(cropId: string): Promise<CropPestControlSnapshot[]> {
    const rows = await this.prisma.cropPestControl.findMany({ where: { cropId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async listByPest(pestId: string): Promise<CropPestControlSnapshot[]> {
    const rows = await this.prisma.cropPestControl.findMany({ where: { pestId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(c: CropPestControlSnapshot) {
    return {
      cropId: c.cropId, pestId: c.pestId, susceptibility: c.susceptibility,
      sensitiveStages: c.sensitiveStages as unknown as Prisma.InputJsonValue,
      threshold: c.threshold ?? null,
      controlMethods: c.controlMethods as unknown as Prisma.InputJsonValue,
      provenance: (c.provenance ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaControl): CropPestControlSnapshot {
    return {
      cropId: row.cropId, pestId: row.pestId, susceptibility: row.susceptibility as SusceptibilityLevel,
      sensitiveStages: row.sensitiveStages as unknown as string[],
      threshold: row.threshold ?? undefined,
      controlMethods: row.controlMethods as unknown as CropPestControlSnapshot['controlMethods'],
      provenance: (row.provenance ?? undefined) as CropPestControlSnapshot['provenance'],
    };
  }
}
