import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignRepository } from '../../application/parcel/campaign.repository';
import { CampaignSnapshot } from '../../domain/parcel/campaign';

type Row = { id: string; organizationId: string; parcelId: string; cropId: string; varietyId: string | null; season: string; startDate: string | null; status: string; notes: string | null; createdAt: Date };

@Injectable()
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: Row): CampaignSnapshot {
    return { id: r.id, organizationId: r.organizationId, parcelId: r.parcelId, cropId: r.cropId, varietyId: r.varietyId ?? undefined, season: r.season, startDate: r.startDate ?? undefined, status: r.status as CampaignSnapshot['status'], notes: r.notes ?? undefined, createdAt: r.createdAt.toISOString() };
  }
  async save(c: CampaignSnapshot): Promise<void> {
    const data = { id: c.id, organizationId: c.organizationId, parcelId: c.parcelId, cropId: c.cropId, varietyId: c.varietyId ?? null, season: c.season, startDate: c.startDate ?? null, status: c.status, notes: c.notes ?? null };
    await this.prisma.campaign.upsert({ where: { id: c.id }, create: data, update: data });
  }
  async findById(id: string): Promise<CampaignSnapshot | null> {
    const r = await this.prisma.campaign.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByParcel(organizationId: string, parcelId: string): Promise<CampaignSnapshot[]> {
    const rows = await this.prisma.campaign.findMany({ where: { organizationId, parcelId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.campaign.delete({ where: { id } }); }
}
