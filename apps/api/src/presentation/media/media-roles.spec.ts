import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { MediaController } from './media.controller';

const reflector = new Reflector();

describe('MediaController — upload ouvert aux rôles tenant (écriture)', () => {
  it('POST /media porte les rôles plateforme ET les 3 rôles tenant écriture', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, MediaController.prototype.uploadFile);
    expect(roles).toContain('superadmin');
    expect(roles).toContain('admin');
    expect(roles).toContain('editor');
    expect(roles).toContain('ORG_ADMIN');
    expect(roles).toContain('AGRONOMIST');
    expect(roles).toContain('FIELD_AGENT');
  });
});
