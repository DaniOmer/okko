import { UserRepository, OrganizationRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { AuthTokenService } from './auth-token.service';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { EmailAlreadyUsedError } from './errors';
import { User } from './types';

export interface RegisterInput { email: string; password: string; name: string; organizationName: string; }

export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly orgs: OrganizationRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterInput): Promise<{ token: string; user: User }> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new EmailAlreadyUsedError(email);
    const now = new Date(this.clock.nowIso());
    const org = { id: this.ids.next(), name: input.organizationName, createdAt: now };
    await this.orgs.save(org);
    const user: User = { id: this.ids.next(), email, name: input.name, role: 'admin', organizationId: org.id, createdAt: now, emailVerifiedAt: null };
    await this.users.save(user);
    await this.identities.save({ id: this.ids.next(), userId: user.id, provider: 'password', identifier: email, secret: await this.hasher.hash(input.password), createdAt: now });
    const token = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId });
    return { token, user };
  }
}
