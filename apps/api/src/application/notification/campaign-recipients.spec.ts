import { resolveCampaignRecipients } from './campaign-recipients';
import { InMemoryNotificationPreferenceRepository } from './in-memory-notification-preference.repository';
import type { UserRepository } from '../auth/repositories';
import type { User } from '../auth/types';

const mkUser = (over: Partial<User>): User => ({ id: 'u', email: 'u@x.z', firstName: 'A', lastName: 'B', role: 'AGRONOMIST', organizationId: 'o1', emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), ...over });
const userRepoOf = (users: User[]): UserRepository => ({ listByOrganization: async () => users } as unknown as UserRepository);

describe('resolveCampaignRecipients', () => {
  it('renvoie {userId,email,everyNDays} ; defaut 1 sans preference ; exclut VIEWER et non confirmes', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const users = [
      mkUser({ id: '1', email: 'agro@x.z', role: 'AGRONOMIST' }),
      mkUser({ id: '2', email: 'agent@x.z', role: 'FIELD_AGENT' }),
      mkUser({ id: '3', email: 'admin@x.z', role: 'ORG_ADMIN' }),
      mkUser({ id: '4', email: 'viewer@x.z', role: 'VIEWER' }),
      mkUser({ id: '5', email: 'pending@x.z', role: 'AGRONOMIST', emailVerifiedAt: null }),
    ];
    const out = await resolveCampaignRecipients(userRepoOf(users), prefs, 'o1');
    expect(out.map((r) => r.email).sort()).toEqual(['admin@x.z', 'agent@x.z', 'agro@x.z']);
    expect(out.every((r) => r.everyNDays === 1)).toBe(true);
  });
  it('exclut everyNDays === 0 (jamais) ; conserve la valeur choisie', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    await prefs.upsert('1', 0);
    await prefs.upsert('2', 3);
    const users = [mkUser({ id: '1', email: 'off@x.z' }), mkUser({ id: '2', email: 'every3@x.z' })];
    const out = await resolveCampaignRecipients(userRepoOf(users), prefs, 'o1');
    expect(out).toEqual([{ userId: '2', email: 'every3@x.z', everyNDays: 3 }]);
  });
});
