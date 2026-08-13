import { NotificationPreferenceController } from './notification-preference.controller';
import { InMemoryNotificationPreferenceRepository } from '../../application/notification/in-memory-notification-preference.repository';
import type { AuthUser } from '../auth/decorators';

const user = { sub: 'u1', email: 'u@x.z', role: 'AGRONOMIST', organizationId: 'o1' } as AuthUser;

describe('NotificationPreferenceController', () => {
  it('GET defaut 1 sans preference ; PATCH stocke et relit', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const ctrl = new NotificationPreferenceController(prefs);
    expect(await ctrl.get(user)).toEqual({ reminderEveryNDays: 1 });
    expect(await ctrl.patch(user, { reminderEveryNDays: 2 })).toEqual({ reminderEveryNDays: 2 });
    expect(await ctrl.get(user)).toEqual({ reminderEveryNDays: 2 });
  });
  it('PATCH ramene une valeur hors {0,1,2,3,7} a 1', async () => {
    const prefs = new InMemoryNotificationPreferenceRepository();
    const ctrl = new NotificationPreferenceController(prefs);
    expect(await ctrl.patch(user, { reminderEveryNDays: 99 })).toEqual({ reminderEveryNDays: 1 });
    expect(await ctrl.patch(user, { reminderEveryNDays: 0 })).toEqual({ reminderEveryNDays: 0 });
  });
});
