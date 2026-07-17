import { UserRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { AuthTokenService } from './auth-token.service';
import { InvalidCredentialsError, EmailNotConfirmedError } from './errors';
import { User } from './types';

export interface LoginInput { email: string; password: string; }

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
  ) {}

  async execute(input: LoginInput): Promise<{ token: string; user: User }> {
    const email = input.email.trim().toLowerCase();
    const identity = await this.identities.findByProviderIdentifier('password', email);
    if (!identity) throw new InvalidCredentialsError();
    if (!(await this.hasher.verify(input.password, identity.secret))) throw new InvalidCredentialsError();
    const user = await this.users.findById(identity.userId);
    if (!user) throw new InvalidCredentialsError();
    if (!user.emailVerifiedAt) throw new EmailNotConfirmedError();
    const token = this.tokens.sign({ sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId });
    return { token, user };
  }
}
