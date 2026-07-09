import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Variety as PrismaVariety } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VarietyRepository } from '../../application/crop/variety.repository';
import { VarietySnapshot } from '../../domain/crop/variety';

@Injectable()
export class PrismaVarietyRepository implements VarietyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(v: VarietySnapshot): Promise<void> {
    await this.prisma.variety.upsert({
      where: { id: v.id },
      create: this.toRow(v),
      update: this.toRow(v),
    });
  }

  async listByCrop(cropId: string): Promise<VarietySnapshot[]> {
    const rows = await this.prisma.variety.findMany({
      where: { cropId }, orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toSnapshot(r));
  }

  async replaceForCrop(cropId: string, items: VarietySnapshot[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.variety.deleteMany({ where: { cropId } }),
      ...items.map((v) => this.prisma.variety.create({ data: this.toRow(v) })),
    ]);
  }

  private toRow(v: VarietySnapshot) {
    return {
      id: v.id,
      cropId: v.cropId,
      name: v.name as Prisma.InputJsonValue,
      maturityDays: v.maturityDays ?? null,
      yieldPotential: (v.yieldPotential ?? undefined) as Prisma.InputJsonValue | undefined,
      traits: v.traits as Prisma.InputJsonValue,
      provenance: (v.provenance ?? undefined) as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaVariety): VarietySnapshot {
    return {
      id: row.id,
      cropId: row.cropId,
      name: row.name as Record<string, string>,
      maturityDays: row.maturityDays ?? undefined,
      yieldPotential: (row.yieldPotential ?? undefined) as VarietySnapshot['yieldPotential'],
      traits: row.traits as string[],
      provenance: (row.provenance ?? undefined) as VarietySnapshot['provenance'],
    };
  }
}
