import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BeneficiaryRepository } from '../../application/parcel/beneficiary.repository';
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';

@Injectable()
export class PrismaBeneficiaryRepository implements BeneficiaryRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: { id: string; organizationId: string; name: string; phone: string | null; notes: string | null; createdAt: Date }): BeneficiarySnapshot {
    return { id: r.id, organizationId: r.organizationId, name: r.name, phone: r.phone ?? undefined, notes: r.notes ?? undefined, createdAt: r.createdAt.toISOString() };
  }
  async save(b: BeneficiarySnapshot): Promise<void> {
    const data = { id: b.id, organizationId: b.organizationId, name: b.name, phone: b.phone ?? null, notes: b.notes ?? null };
    await this.prisma.beneficiary.upsert({ where: { id: b.id }, create: data, update: data });
  }
  async findById(id: string): Promise<BeneficiarySnapshot | null> {
    const r = await this.prisma.beneficiary.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByOrganization(organizationId: string): Promise<BeneficiarySnapshot[]> {
    const rows = await this.prisma.beneficiary.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.beneficiary.delete({ where: { id } }); }
}
