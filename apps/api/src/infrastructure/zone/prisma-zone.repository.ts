import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgroEcologicalZone as PrismaZone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ZoneRepository } from '../../application/zone/zone.repository';
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { MediaImageJSON } from '../../domain/media/media-image';

@Injectable()
export class PrismaZoneRepository implements ZoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(z: ZoneSnapshot): Promise<void> {
    await this.prisma.agroEcologicalZone.upsert({
      where: { id: z.id }, create: this.toRow(z), update: this.toRow(z),
    });
  }

  async findById(id: string): Promise<ZoneSnapshot | null> {
    const row = await this.prisma.agroEcologicalZone.findUnique({ where: { id } });
    return row ? this.toSnapshot(row) : null;
  }

  async list(): Promise<ZoneSnapshot[]> {
    const rows = await this.prisma.agroEcologicalZone.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agroEcologicalZone.delete({ where: { id } });
  }

  private toRow(z: ZoneSnapshot) {
    return {
      id: z.id,
      name: z.name as Prisma.InputJsonValue,
      country: z.country,
      koppen: z.koppen ?? null,
      code: z.code ?? null,
      region: z.region ?? null,
      description: (z.description ?? undefined) as Prisma.InputJsonValue | undefined,
      climateType: z.climateType ?? null,
      meanTemperature: z.meanTemperature ?? null,
      meanHumidity: z.meanHumidity ?? null,
      rainySeasonStart: z.rainySeasonStart ?? null,
      rainySeasonEnd: z.rainySeasonEnd ?? null,
      drySeasonStart: z.drySeasonStart ?? null,
      drySeasonEnd: z.drySeasonEnd ?? null,
      soilTypes: (z.soilTypes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      fertility: z.fertility ?? null,
      drainage: z.drainage ?? null,
      altitude: (z.altitude ?? undefined) as Prisma.InputJsonValue | undefined,
      annualRainfall: (z.annualRainfall ?? undefined) as Prisma.InputJsonValue | undefined,
      notes: z.notes ?? null,
      metadata: z.metadata as Prisma.InputJsonValue,
      images: z.images as unknown as Prisma.InputJsonValue,
    };
  }

  private toSnapshot(row: PrismaZone): ZoneSnapshot {
    return {
      id: row.id,
      name: row.name as Record<string, string>,
      country: row.country,
      koppen: row.koppen ?? undefined,
      code: row.code ?? undefined,
      region: row.region ?? undefined,
      description: (row.description ?? undefined) as Record<string, string> | undefined,
      climateType: row.climateType ?? undefined,
      meanTemperature: row.meanTemperature ?? undefined,
      meanHumidity: row.meanHumidity ?? undefined,
      rainySeasonStart: row.rainySeasonStart ?? undefined,
      rainySeasonEnd: row.rainySeasonEnd ?? undefined,
      drySeasonStart: row.drySeasonStart ?? undefined,
      drySeasonEnd: row.drySeasonEnd ?? undefined,
      soilTypes: (row.soilTypes ?? undefined) as string[] | undefined,
      fertility: row.fertility ?? undefined,
      drainage: row.drainage ?? undefined,
      altitude: (row.altitude ?? undefined) as ZoneSnapshot['altitude'],
      annualRainfall: (row.annualRainfall ?? undefined) as ZoneSnapshot['annualRainfall'],
      notes: row.notes ?? undefined,
      metadata: row.metadata as Record<string, unknown>,
      images: (row.images ?? []) as unknown as MediaImageJSON[],
    };
  }
}
