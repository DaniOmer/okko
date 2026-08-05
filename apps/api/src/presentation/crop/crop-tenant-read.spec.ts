import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { CropController } from './crop.controller';

const reflector = new Reflector();

describe('CropController — frontière lecture/écriture', () => {
  it('GET /crops/published est ouvert aux rôles tenant', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CropController.prototype.listPublished);
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('VIEWER');
    expect(roles).toContain('superadmin');
  });
  it('GET /crops/:id/published est ouvert aux rôles tenant', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CropController.prototype.published);
    expect(roles).toContain('AGRONOMIST');
    expect(roles).toContain('superadmin');
  });
  it("l'écriture (create) reste réservée : pas de @Roles method-level (hérite superadmin de la classe)", () => {
    const roles = reflector.get<string[]>(ROLES_KEY, CropController.prototype.create);
    expect(roles).toBeUndefined();
  });
});
