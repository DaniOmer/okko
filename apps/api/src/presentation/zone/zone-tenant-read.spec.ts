import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { ZoneController } from './zone.controller';

const reflector = new Reflector();

describe('ZoneController — liste ouverte aux tenants', () => {
  it('GET /zones (list) autorise les rôles tenant', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, ZoneController.prototype.list);
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('VIEWER');
    expect(roles).toContain('superadmin');
  });
  it("l'écriture (create) n'a pas de @Roles method-level (reste superadmin de la classe)", () => {
    expect(reflector.get<string[]>(ROLES_KEY, ZoneController.prototype.create)).toBeUndefined();
  });
});
