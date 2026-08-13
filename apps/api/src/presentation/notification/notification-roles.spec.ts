import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { CampaignController } from '../parcel/campaign.controller';
import { NotificationPreferenceController } from './notification-preference.controller';

const reflector = new Reflector();
describe('Roles notifications de suivi', () => {
  it('POST /campaigns/:id/notify-reminder = 3 roles ecriture (VIEWER exclu)', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CampaignController.prototype.notifyReminder);
    expect(roles).toEqual(['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT']);
    expect(roles).not.toContain('VIEWER');
  });
  it('GET/PATCH /me/notification-preferences = 4 roles tenant (VIEWER inclus)', () => {
    expect(reflector.get<string[]>(ROLES_KEY, NotificationPreferenceController.prototype.get)).toContain('VIEWER');
    expect(reflector.get<string[]>(ROLES_KEY, NotificationPreferenceController.prototype.patch)).toContain('VIEWER');
  });
});
