import { InvitationRepository, UserRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { AuthTokenService } from './auth-token.service';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { InvitationNotFoundError, InvitationInvalidError, EmailAlreadyUsedError } from './errors';
import { User } from './types';

export interface AcceptInvitationInput { token: string; name: string; password: string; }

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AcceptInvitationInput): Promise<{ token: string; user: User }> {
    const inv = await this.invitations.findByToken(input.token);
    if (!inv) throw new InvitationNotFoundError(input.token);
    const now = new Date(this.clock.nowIso());
    if (inv.status !== 'pending' || inv.expiresAt.getTime() < now.getTime()) throw new InvitationInvalidError();
    if (await this.users.findByEmail(inv.email)) throw new EmailAlreadyUsedError(inv.email);
    const user: User = { id: this.ids.next(), email: inv.email, name: input.name, role: 'editor', organizationId: inv.organizationId, createdAt: now };
    await this.users.save(user);
    await this.identities.save({ id: this.ids.next(), userId: user.id, provider: 'password', identifier: inv.email, secret: await this.hasher.hash(input.password), createdAt: now });
    await this.invitations.save({ ...inv, status: 'accepted', acceptedAt: now });
    const token = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId });
    return { token, user };
  }
}
