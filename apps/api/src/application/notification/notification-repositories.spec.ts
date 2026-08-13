import { InMemoryNotificationLogRepository } from './in-memory-notification-log.repository';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';

describe('Repos notification (in-memory)', () => {
  it('log: lastSentAt null puis date ; recordSent en upsert (une seule ligne par clé)', async () => {
    const log = new InMemoryNotificationLogRepository();
    expect(await log.lastSentAt('k')).toBeNull();
    await log.recordSent({ id: '1', organizationId: 'o1', dedupKey: 'k', kind: 'campaign_reminder', sentAt: '2026-08-12T00:00:00.000Z' });
    expect(await log.lastSentAt('k')).toBe('2026-08-12T00:00:00.000Z');
    await log.recordSent({ id: '2', organizationId: 'o1', dedupKey: 'k', kind: 'campaign_reminder', sentAt: '2026-08-14T00:00:00.000Z' });
    expect(await log.lastSentAt('k')).toBe('2026-08-14T00:00:00.000Z');
    expect(log.entries).toHaveLength(1);
  });
  it('preference: absente → null ; upsert (nombre) → relecture', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    expect(await prefs.findByUserId('u1')).toBeNull();
    await prefs.upsert('u1', 2);
    expect(await prefs.findByUserId('u1')).toEqual({ userId: 'u1', reminderEveryNDays: 2 });
  });
});
