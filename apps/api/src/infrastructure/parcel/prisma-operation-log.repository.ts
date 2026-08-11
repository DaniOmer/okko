import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogRepository } from '../../application/parcel/operation-log.repository';
import { OperationLogSnapshot, OperationInput } from '../../domain/parcel/operation-log';
import { OperationType } from '../../domain/window/operation-type';

type Row = { id: string; organizationId: string; campaignId: string; type: string; date: string; inputs: Prisma.JsonValue; laborCost: number | null; notes: string | null; recordedByUserId: string; createdAt: Date };

@Injectable()
export class PrismaOperationLogRepository implements OperationLogRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toSnap(r: Row): OperationLogSnapshot {
    return { id: r.id, organizationId: r.organizationId, campaignId: r.campaignId, type: r.type as OperationType, date: r.date, inputs: (r.inputs ?? []) as unknown as OperationInput[], laborCost: r.laborCost ?? undefined, notes: r.notes ?? undefined, recordedByUserId: r.recordedByUserId, createdAt: r.createdAt.toISOString() };
  }
  async save(o: OperationLogSnapshot): Promise<void> {
    const data = { id: o.id, organizationId: o.organizationId, campaignId: o.campaignId, type: o.type, date: o.date, inputs: (o.inputs ?? []) as unknown as Prisma.InputJsonValue, laborCost: o.laborCost ?? null, notes: o.notes ?? null, recordedByUserId: o.recordedByUserId };
    await this.prisma.operationLog.upsert({ where: { id: o.id }, create: data, update: data });
  }
  async findById(id: string): Promise<OperationLogSnapshot | null> {
    const r = await this.prisma.operationLog.findUnique({ where: { id } });
    return r ? this.toSnap(r) : null;
  }
  async listByCampaign(organizationId: string, campaignId: string): Promise<OperationLogSnapshot[]> {
    const rows = await this.prisma.operationLog.findMany({ where: { organizationId, campaignId }, orderBy: { date: 'asc' } });
    return rows.map((r) => this.toSnap(r));
  }
  async delete(id: string): Promise<void> { await this.prisma.operationLog.delete({ where: { id } }); }
}
