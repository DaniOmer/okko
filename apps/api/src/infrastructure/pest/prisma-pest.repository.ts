import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PestDisease as PrismaPest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PestRepository } from '../../application/pest/pest.repository';
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestType } from '../../domain/pest/pest-type';

@Injectable()
export class PrismaPestRepository implements PestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(p: PestDiseaseSnapshot): Promise<void> {
    await this.prisma.pestDisease.upsert({ where: { id: p.id }, create: this.toRow(p), update: this.toRow(p) });
  }

  async findById(id: string): Promise<PestDiseaseSnapshot | null> {
    const row = await this.prisma.pestDisease.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<PestDiseaseSnapshot[]> {
    const rows = await this.prisma.pestDisease.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.pestDisease.delete({ where: { id } });
  }

  private toRow(p: PestDiseaseSnapshot): Prisma.PestDiseaseCreateInput {
    return {
      id: p.id, name: p.name as Prisma.InputJsonValue, type: p.type,
      scientificName: p.scientificName ?? null,
      symptoms: (p.symptoms ?? undefined) as Prisma.InputJsonValue | undefined,
      photos: p.photos as unknown as Prisma.InputJsonValue,
      notes: p.notes ?? null, metadata: p.metadata as Prisma.InputJsonValue,
    };
  }

  private toSnapshot(row: PrismaPest): PestDiseaseSnapshot {
    return {
      id: row.id, name: row.name as Record<string, string>, type: row.type as PestType,
      scientificName: row.scientificName ?? undefined,
      symptoms: (row.symptoms ?? undefined) as PestDiseaseSnapshot['symptoms'],
      photos: row.photos as unknown as string[],
      notes: row.notes ?? undefined, metadata: row.metadata as Record<string, unknown>,
    };
  }
}
