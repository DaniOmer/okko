import { rolesFor, PLATFORM_ROLES, TENANT_ROLES } from './roles';

describe('rolesFor', () => {
  it('CUSTOMER → rôles tenant (ORG_ADMIN inclus, editor exclu)', () => {
    expect(rolesFor('CUSTOMER')).toBe(TENANT_ROLES);
    expect(rolesFor('CUSTOMER')).toContain('ORG_ADMIN');
    expect(rolesFor('CUSTOMER')).not.toContain('editor');
  });
  it('PLATFORM → rôles plateforme (editor inclus, ORG_ADMIN exclu)', () => {
    expect(rolesFor('PLATFORM')).toBe(PLATFORM_ROLES);
    expect(rolesFor('PLATFORM')).toContain('editor');
    expect(rolesFor('PLATFORM')).not.toContain('ORG_ADMIN');
  });
});
