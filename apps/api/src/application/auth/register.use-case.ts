import { UserRepository, OrganizationRepository, AuthIdentityRepository } from './repositories';
import { PasswordHasher } from './password-hasher';
import { NotificationPort } from '../notification/notification-port';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { EmailAlreadyUsedError } from './errors';
import { CONFIRM_TTL_HOURS } from './confirmation';
import { User } from './types';

export interface RegisterInput { email: string; password: string; name: string; organizationName: string; }

export class RegisterUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly orgs: OrganizationRepository,
    private readonly identities: AuthIdentityRepository,
    private readonly hasher: PasswordHasher,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterInput): Promise<{ email: string }> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new EmailAlreadyUsedError(email);
    const now = new Date(this.clock.nowIso());
    const org = { id: this.ids.next(), name: input.organizationName, createdAt: now };
    await this.orgs.save(org);
    const user: User = { id: this.ids.next(), email, name: input.name, role: 'admin', organizationId: org.id, createdAt: now, emailVerifiedAt: null };
    await this.users.save(user);
    await this.identities.save({ id: this.ids.next(), userId: user.id, provider: 'password', identifier: email, secret: await this.hasher.hash(input.password), createdAt: now });
    const token = this.ids.next();
    const expiresAt = new Date(now.getTime() + CONFIRM_TTL_HOURS * 60 * 60 * 1000);
    await this.users.setConfirmationToken(user.id, token, expiresAt);
    const confirmUrl = `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/confirm/${token}`;
    try { await this.notifier.send({ kind: 'email_confirmation', to: email, confirmUrl, expiresAt }); } catch { /* email non parti — renvoi possible */ }
    return { email };
  }
}
