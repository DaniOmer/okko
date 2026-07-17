import { UserRepository } from './repositories';
import { NotificationPort } from '../notification/notification-port';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { CONFIRM_TTL_HOURS } from './confirmation';

export class ResendConfirmationUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}
  async execute(input: { email: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return; // anti-énumération : aucun effet, aucune fuite
    const now = new Date(this.clock.nowIso());
    const token = this.ids.next();
    const expiresAt = new Date(now.getTime() + CONFIRM_TTL_HOURS * 60 * 60 * 1000);
    await this.users.setConfirmationToken(user.id, token, expiresAt);
    const confirmUrl = `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/confirm/${token}`;
    try { await this.notifier.send({ kind: 'email_confirmation', to: email, confirmUrl, expiresAt }); } catch { /* */ }
  }
}
