import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry, AuditLogRepository } from '../../application/audit/audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        actor: entry.actor,
        at: new Date(entry.at),
        changes: entry.changes,
      },
    });
  }
}
