import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CropRepository } from '../../application/crop/crop.repository';
import { CropSnapshot } from '../../domain/crop/crop';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';
import { Prisma } from '@prisma/client';
import type { Crop as PrismaCrop } from '@prisma/client';

@Injectable()
export class PrismaCropRepository implements CropRepository {
  constructor(private readonly prisma: PrismaService) {}

  // NOTE (Plan 1): last-writer-wins. Optimistic concurrency (a version-guarded update) is deferred — the v1 back-office has a single admin role. Revisit when multi-editor support lands (see spec §6.1).
  async save(s: CropSnapshot): Promise<void> {
    const payload = {
      ...s,
      commonNames: s.commonNames as Prisma.InputJsonValue,
      metadata: s.metadata as Prisma.InputJsonValue,
      climatic: (s.climatic ?? undefined) as Prisma.InputJsonValue | undefined,
      edaphic: (s.edaphic ?? undefined) as Prisma.InputJsonValue | undefined,
    };
    await this.prisma.crop.upsert({
      where: { id: s.id },
      create: payload,
      update: payload,
    });
  }

  async findById(id: string): Promise<CropSnapshot | null> {
    const row = await this.prisma.crop.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<CropSnapshot[]> {
    const rows = await this.prisma.crop.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toSnapshot(row: PrismaCrop): CropSnapshot {
    return {
      id: row.id,
      commonNames: row.commonNames as Record<string, string>,
      scientificName: row.scientificName,
      family: row.family,
      cycleType: row.cycleType as CycleType,
      status: row.status as CropStatus,
      version: row.version,
      metadata: row.metadata as Record<string, unknown>,
      climatic: (row.climatic ?? undefined) as CropSnapshot['climatic'],
      edaphic: (row.edaphic ?? undefined) as CropSnapshot['edaphic'],
    };
  }
}
