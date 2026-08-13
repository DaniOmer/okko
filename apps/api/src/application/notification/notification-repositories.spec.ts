import { InMemoryNotificationLogRepository } from './in-memory-notification-log.repository';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';

describe('Repos notification (in-memory)', () => {
  it('log: existsByDedupKey passe de false a true apres record', async () => {
    const log = new InMemoryNotificationLogRepository();
    expect(await log.existsByDedupKey('k')).toBe(false);
    await log.record({ id: '1', organizationId: 'o1', dedupKey: 'k', kind: 'campaign_reminder', sentAt: '2026-08-12T00:00:00.000Z' });
    expect(await log.existsByDedupKey('k')).toBe(true);
  });
  it('preference: absente → null ; upsert (nombre) → relecture', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    expect(await prefs.findByUserId('u1')).toBeNull();
    await prefs.upsert('u1', 2);
    expect(await prefs.findByUserId('u1')).toEqual({ userId: 'u1', reminderEveryNDays: 2 });
  });
});
