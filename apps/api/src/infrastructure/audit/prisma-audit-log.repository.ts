import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry, AuditLogRepository, AuditLogReader, AuditRecord } from '../../application/audit/audit-log.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository, AuditLogReader {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        actor: entry.actor,
        at: new Date(entry.at),
        changes: entry.changes as Prisma.InputJsonValue,
      },
    });
  }

  async listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { at: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actor,
      at: r.at.toISOString(),
      changes: r.changes as Record<string, unknown>,
    }));
  }
}
