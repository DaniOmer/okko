import { Role, OrgKind } from './types';

export const PLATFORM_ROLES: Role[] = ['superadmin', 'admin', 'editor'];
export const TENANT_ROLES: Role[] = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];

export function rolesFor(kind: OrgKind): Role[] {
  return kind === 'PLATFORM' ? PLATFORM_ROLES : TENANT_ROLES;
}
