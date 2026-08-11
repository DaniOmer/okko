import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { CampaignController } from './campaign.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('CampaignController — rôles', () => {
  it('lecture = 4 rôles', () => { expect(reflector.get<string[]>(ROLES_KEY, CampaignController.prototype.list)).toEqual(READ); });
  it('écriture = 3 rôles', () => {
    for (const m of [CampaignController.prototype.create, CampaignController.prototype.update, CampaignController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
