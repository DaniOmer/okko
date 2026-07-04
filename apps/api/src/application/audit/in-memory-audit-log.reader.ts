import { AuditLogReader, AuditRecord } from './audit-log.repository';

export class InMemoryAuditLogReader implements AuditLogReader {
  constructor(private readonly records: AuditRecord[] = []) {}
  async listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]> {
    return this.records
      .filter((r) => r.entityType === entityType && r.entityId === entityId)
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }
}
