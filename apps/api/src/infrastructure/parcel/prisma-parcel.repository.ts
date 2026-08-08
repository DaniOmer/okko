import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParcelRepository } from '../../application/parcel/parcel.repository';
import { ParcelSnapshot } from '../../domain/parcel/parcel';

type Row = { id: string; organizationId: string; name: string; beneficiaryId: string | null; zoneId: string | null; gpsLat: number | null; gpsLng: number | null; locality: string | null; areaHectares: number | null; notes: string | null; createdAt: Date };

@Injectable()
export class PrismaParcelRepository implements ParcelRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: Row): ParcelSnapshot {
    return {
      id: r.id, organizationId: r.organizationId, name: r.name,
      beneficiaryId: r.beneficiaryId ?? undefined, zoneId: r.zoneId ?? undefined,
      gpsLat: r.gpsLat ?? undefined, gpsLng: r.gpsLng ?? undefined, locality: r.locality ?? undefined,
      areaHectares: r.areaHectares ?? undefined, notes: r.notes ?? undefined, createdAt: r.createdAt.toISOString(),
    };
  }
  async save(p: ParcelSnapshot): Promise<void> {
    const data = { id: p.id, organizationId: p.organizationId, name: p.name, beneficiaryId: p.beneficiaryId ?? null, zoneId: p.zoneId ?? null, gpsLat: p.gpsLat ?? null, gpsLng: p.gpsLng ?? null, locality: p.locality ?? null, areaHectares: p.areaHectares ?? null, notes: p.notes ?? null };
    await this.prisma.parcel.upsert({ where: { id: p.id }, create: data, update: data });
  }
  async findById(id: string): Promise<ParcelSnapshot | null> {
    const r = await this.prisma.parcel.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByOrganization(organizationId: string): Promise<ParcelSnapshot[]> {
    const rows = await this.prisma.parcel.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.parcel.delete({ where: { id } }); }
}
