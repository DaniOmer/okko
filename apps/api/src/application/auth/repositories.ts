import { User, Organization, AuthIdentity, Invitation } from './types';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export interface UserRepository {
  save(u: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listByOrganization(organizationId: string): Promise<User[]>;
  findByConfirmationToken(token: string): Promise<{ user: User; expiresAt: Date } | null>;
  setConfirmationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  confirmEmail(userId: string, verifiedAt: Date): Promise<void>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');
export interface OrganizationRepository {
  save(o: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
}

export const AUTH_IDENTITY_REPOSITORY = Symbol('AUTH_IDENTITY_REPOSITORY');
export interface AuthIdentityRepository {
  save(i: AuthIdentity): Promise<void>;
  findByProviderIdentifier(provider: string, identifier: string): Promise<AuthIdentity | null>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
export interface InvitationRepository {
  save(inv: Invitation): Promise<void>;
  findById(id: string): Promise<Invitation | null>;
  findByToken(token: string): Promise<Invitation | null>;
  findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null>;
  listByOrganization(organizationId: string): Promise<Invitation[]>;
}
