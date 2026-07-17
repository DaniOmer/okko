import { User, Organization, AuthIdentity, Invitation } from './types';
import { UserRepository, OrganizationRepository, AuthIdentityRepository, InvitationRepository } from './repositories';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows: User[] = [];
  async save(u: User): Promise<void> { const i = this.rows.findIndex((r) => r.id === u.id); if (i >= 0) this.rows[i] = u; else this.rows.push(u); }
  async findById(id: string): Promise<User | null> { return this.rows.find((r) => r.id === id) ?? null; }
  async findByEmail(email: string): Promise<User | null> { return this.rows.find((r) => r.email === email) ?? null; }
  async listByOrganization(organizationId: string): Promise<User[]> { return this.rows.filter((r) => r.organizationId === organizationId); }
  private readonly confirmations = new Map<string, { token: string; expiresAt: Date }>();
  async findByConfirmationToken(token: string): Promise<{ user: User; expiresAt: Date } | null> {
    for (const [userId, c] of this.confirmations) {
      if (c.token === token) { const user = this.rows.find((r) => r.id === userId); if (user) return { user, expiresAt: c.expiresAt }; }
    }
    return null;
  }
  async setConfirmationToken(userId: string, token: string, expiresAt: Date): Promise<void> { this.confirmations.set(userId, { token, expiresAt }); }
  async confirmEmail(userId: string, verifiedAt: Date): Promise<void> {
    const i = this.rows.findIndex((r) => r.id === userId);
    if (i >= 0) this.rows[i] = { ...this.rows[i], emailVerifiedAt: verifiedAt };
    this.confirmations.delete(userId);
  }
}
export class InMemoryOrganizationRepository implements OrganizationRepository {
  private readonly rows: Organization[] = [];
  async save(o: Organization): Promise<void> { const i = this.rows.findIndex((r) => r.id === o.id); if (i >= 0) this.rows[i] = o; else this.rows.push(o); }
  async findById(id: string): Promise<Organization | null> { return this.rows.find((r) => r.id === id) ?? null; }
}
export class InMemoryAuthIdentityRepository implements AuthIdentityRepository {
  private readonly rows: AuthIdentity[] = [];
  async save(i: AuthIdentity): Promise<void> { const j = this.rows.findIndex((r) => r.id === i.id); if (j >= 0) this.rows[j] = i; else this.rows.push(i); }
  async findByProviderIdentifier(provider: string, identifier: string): Promise<AuthIdentity | null> {
    return this.rows.find((r) => r.provider === provider && r.identifier === identifier) ?? null;
  }
}
export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly rows: Invitation[] = [];
  async save(inv: Invitation): Promise<void> { const i = this.rows.findIndex((r) => r.id === inv.id); if (i >= 0) this.rows[i] = inv; else this.rows.push(inv); }
  async findById(id: string): Promise<Invitation | null> { return this.rows.find((r) => r.id === id) ?? null; }
  async findByToken(token: string): Promise<Invitation | null> { return this.rows.find((r) => r.token === token) ?? null; }
  async findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    return this.rows.find((r) => r.email === email && r.organizationId === organizationId && r.status === 'pending') ?? null;
  }
  async listByOrganization(organizationId: string): Promise<Invitation[]> { return this.rows.filter((r) => r.organizationId === organizationId); }
}
