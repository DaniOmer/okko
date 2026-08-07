import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { BeneficiaryController } from './beneficiary.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('BeneficiaryController — rôles', () => {
  it('lecture = 4 rôles tenant', () => {
    expect(reflector.get<string[]>(ROLES_KEY, BeneficiaryController.prototype.list)).toEqual(READ);
  });
  it('écriture = 3 rôles (pas VIEWER)', () => {
    for (const m of [BeneficiaryController.prototype.create, BeneficiaryController.prototype.update, BeneficiaryController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
