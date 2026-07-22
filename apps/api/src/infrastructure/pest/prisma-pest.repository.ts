import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Pest as PrismaPest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PestRepository } from '../../application/pest/pest.repository';
import { PestSnapshot } from '../../domain/pest/pest';
import { PestType } from '../../domain/pest/pest-type';
import { MediaImageJSON } from '../../domain/media/media-image';

@Injectable()
export class PrismaPestRepository implements PestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(p: PestSnapshot): Promise<void> {
    await this.prisma.pest.upsert({ where: { id: p.id }, create: this.toRow(p), update: this.toRow(p) });
  }

  async findById(id: string): Promise<PestSnapshot | null> {
    const row = await this.prisma.pest.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<PestSnapshot[]> {
    const rows = await this.prisma.pest.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.pest.delete({ where: { id } });
  }

  private toRow(p: PestSnapshot): Prisma.PestCreateInput {
    return {
      id: p.id, name: p.name as Prisma.InputJsonValue, type: p.type,
      scientificName: p.scientificName ?? null,
      family: p.family ?? null,
      description: (p.description ?? undefined) as Prisma.InputJsonValue | undefined,
      symptoms: (p.symptoms ?? undefined) as Prisma.InputJsonValue | undefined,
      photos: p.images as unknown as Prisma.InputJsonValue,
      notes: p.notes ?? null, metadata: p.metadata as Prisma.InputJsonValue,
    };
  }

  private toSnapshot(row: PrismaPest): PestSnapshot {
    return {
      id: row.id, name: row.name as Record<string, string>, type: row.type as PestType,
      scientificName: row.scientificName ?? undefined,
      family: row.family ?? undefined,
      description: (row.description ?? undefined) as Record<string, string> | undefined,
      updatedAt: row.updatedAt?.toISOString(),
      symptoms: (row.symptoms ?? undefined) as PestSnapshot['symptoms'],
      images: (row.photos ?? []) as unknown as MediaImageJSON[],
      notes: row.notes ?? undefined, metadata: row.metadata as Record<string, unknown>,
    };
  }
}
