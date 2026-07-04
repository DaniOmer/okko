import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PrismaAuditLogRepository } from '../src/infrastructure/audit/prisma-audit-log.repository';

describe('PrismaAuditLogRepository reader (integration)', () => {
  const prisma = new PrismaService();
  const repo = new PrismaAuditLogRepository(prisma);

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.auditLog.deleteMany(); await prisma.$disconnect(); });

  it('records then lists entries for an entity, most recent first', async () => {
    await repo.record({ entityType: 'Crop', entityId: 'c-audit-1', actor: 'a', at: '2026-05-01T00:00:00.000Z', changes: { created: true } });
    await repo.record({ entityType: 'Crop', entityId: 'c-audit-1', actor: 'a', at: '2026-06-01T00:00:00.000Z', changes: { status: 'PUBLISHED' } });
    await repo.record({ entityType: 'Crop', entityId: 'other', actor: 'a', at: '2026-06-02T00:00:00.000Z', changes: {} });

    const list = await repo.listByEntity('Crop', 'c-audit-1');
    expect(list).toHaveLength(2);
    expect(list[0].at).toBe('2026-06-01T00:00:00.000Z'); // most recent first
    expect(typeof list[0].id).toBe('string');
    expect(list[0].changes).toEqual({ status: 'PUBLISHED' });
  });
});
