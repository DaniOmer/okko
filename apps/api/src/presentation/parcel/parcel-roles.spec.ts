import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { ParcelController } from './parcel.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('ParcelController — rôles', () => {
  it('lecture = 4 rôles tenant', () => {
    expect(reflector.get<string[]>(ROLES_KEY, ParcelController.prototype.list)).toEqual(READ);
  });
  it('écriture = 3 rôles (pas VIEWER)', () => {
    for (const m of [ParcelController.prototype.create, ParcelController.prototype.update, ParcelController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
