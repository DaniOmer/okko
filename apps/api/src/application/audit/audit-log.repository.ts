export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface AuditEntry {
  entityType: string;
  entityId: string;
  actor: string;
  at: string;
  changes: Record<string, unknown>;
}

export interface AuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
}

export interface AuditRecord {
  id: string;
  entityType: string;
  entityId: string;
  actor: string;
  at: string;
  changes: Record<string, unknown>;
}

export const AUDIT_LOG_READER = Symbol('AUDIT_LOG_READER');

export interface AuditLogReader {
  listByEntity(entityType: string, entityId: string): Promise<AuditRecord[]>;
}
