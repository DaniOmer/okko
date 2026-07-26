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
      id: p.id, name: p.name as Prisma.InputJsonValue, type: p.type, kind: p.kind,
      scientificName: p.scientificName ?? null,
      family: p.family ?? null,
      description: (p.description ?? undefined) as Prisma.InputJsonValue | undefined,
      symptoms: (p.symptoms ?? undefined) as Prisma.InputJsonValue | undefined,
      photos: p.images as unknown as Prisma.InputJsonValue,
      notes: p.notes ?? null, metadata: p.metadata as Prisma.InputJsonValue,
      lifeCycle: (p.lifeCycle ?? undefined) as Prisma.InputJsonValue | undefined,
      cycleDurationDays: (p.cycleDurationDays ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      developmentStages: (p.developmentStages ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      generationsPerYear: (p.generationsPerYear ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      activityPeriods: (p.activityPeriods ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      favorableConditions: (p.favorableConditions ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      attackedOrgans: (p.attackedOrgans ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      damageTypes: (p.damageTypes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      harmfulnessLevel: p.harmfulnessLevel ?? null,
      nuisanceTypes: (p.nuisanceTypes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      reproductionMode: (p.reproductionMode ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      disseminationCapacity: p.disseminationCapacity ?? null,
      emergenceDepth: (p.emergenceDepth ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      seedBankLongevity: (p.seedBankLongevity ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      geographicAreas: (p.geographicAreas ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      favorableClimate: (p.favorableClimate ?? undefined) as Prisma.InputJsonValue | undefined,
      knownPresence: (p.knownPresence ?? undefined) as Prisma.InputJsonValue | undefined,
      prevention: (p.prevention ?? undefined) as Prisma.InputJsonValue | undefined,
      biologicalControl: (p.biologicalControl ?? undefined) as Prisma.InputJsonValue | undefined,
      predators: (p.predators ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      parasitoids: (p.parasitoids ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      approvedProducts: (p.approvedProducts ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      knownResistances: (p.knownResistances ?? undefined) as Prisma.InputJsonValue | undefined,
      sources: (p.sources ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    };
  }

  private toSnapshot(row: PrismaPest): PestSnapshot {
    return {
      id: row.id, name: row.name as Record<string, string>, type: row.type as PestType,
      scientificName: row.scientificName ?? undefined,
      family: row.family ?? undefined,
      description: (row.description ?? undefined) as Record<string, string> | undefined,
      updatedAt: row.updatedAt.toISOString(),
      symptoms: (row.symptoms ?? undefined) as PestSnapshot['symptoms'],
      images: (row.photos ?? []) as unknown as MediaImageJSON[],
      notes: row.notes ?? undefined, metadata: row.metadata as Record<string, unknown>,
      lifeCycle: (row.lifeCycle ?? undefined) as Record<string, string> | undefined,
      cycleDurationDays: (row.cycleDurationDays ?? undefined) as PestSnapshot['cycleDurationDays'],
      developmentStages: (row.developmentStages ?? undefined) as PestSnapshot['developmentStages'],
      generationsPerYear: (row.generationsPerYear ?? undefined) as PestSnapshot['generationsPerYear'],
      activityPeriods: (row.activityPeriods ?? undefined) as string[] | undefined,
      favorableConditions: (row.favorableConditions ?? undefined) as PestSnapshot['favorableConditions'],
      attackedOrgans: (row.attackedOrgans ?? undefined) as string[] | undefined,
      damageTypes: (row.damageTypes ?? undefined) as string[] | undefined,
      harmfulnessLevel: row.harmfulnessLevel ?? undefined,
      nuisanceTypes: (row.nuisanceTypes ?? undefined) as string[] | undefined,
      reproductionMode: (row.reproductionMode ?? undefined) as string[] | undefined,
      disseminationCapacity: row.disseminationCapacity ?? undefined,
      emergenceDepth: (row.emergenceDepth ?? undefined) as PestSnapshot['emergenceDepth'],
      seedBankLongevity: (row.seedBankLongevity ?? undefined) as PestSnapshot['seedBankLongevity'],
      geographicAreas: (row.geographicAreas ?? undefined) as string[] | undefined,
      favorableClimate: (row.favorableClimate ?? undefined) as Record<string, string> | undefined,
      knownPresence: (row.knownPresence ?? undefined) as Record<string, string> | undefined,
      prevention: (row.prevention ?? undefined) as Record<string, string> | undefined,
      biologicalControl: (row.biologicalControl ?? undefined) as Record<string, string> | undefined,
      predators: (row.predators ?? undefined) as string[] | undefined,
      parasitoids: (row.parasitoids ?? undefined) as string[] | undefined,
      approvedProducts: (row.approvedProducts ?? undefined) as PestSnapshot['approvedProducts'],
      knownResistances: (row.knownResistances ?? undefined) as Record<string, string> | undefined,
      sources: (row.sources ?? undefined) as PestSnapshot['sources'],
      kind: row.kind as PestSnapshot['kind'],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
