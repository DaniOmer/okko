import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CroppingWindow as PrismaWindow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CroppingWindowRepository } from '../../application/window/cropping-window.repository';
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

@Injectable()
export class PrismaCroppingWindowRepository implements CroppingWindowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(w: CroppingWindowSnapshot): Promise<void> {
    await this.prisma.croppingWindow.upsert({
      where: { id: w.id }, create: this.toRow(w), update: this.toRow(w),
    });
  }

  async listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]> {
    const rows = await this.prisma.croppingWindow.findMany({ where: { cropId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(w: CroppingWindowSnapshot): Prisma.CroppingWindowCreateInput {
    return {
      id: w.id, cropId: w.cropId, zoneId: w.zoneId, season: w.season,
      sowingStart: w.sowingStart ?? null, sowingEnd: w.sowingEnd ?? null,
      irrigationRequired: w.irrigationRequired,
      operations: w.operations as unknown as Prisma.InputJsonValue,
      notes: w.notes ?? null,
    };
  }

  private toSnapshot(row: PrismaWindow): CroppingWindowSnapshot {
    return {
      id: row.id, cropId: row.cropId, zoneId: row.zoneId, season: row.season,
      sowingStart: row.sowingStart ?? undefined, sowingEnd: row.sowingEnd ?? undefined,
      irrigationRequired: row.irrigationRequired,
      operations: row.operations as unknown as CroppingWindowSnapshot['operations'],
      notes: row.notes ?? undefined,
    };
  }
}
