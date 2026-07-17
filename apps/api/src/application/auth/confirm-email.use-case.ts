import { UserRepository } from './repositories';
import { Clock } from '../shared/clock';
import { ConfirmationInvalidError } from './errors';

export class ConfirmEmailUseCase {
  constructor(private readonly users: UserRepository, private readonly clock: Clock) {}
  async execute(input: { token: string }): Promise<{ email: string; alreadyConfirmed: boolean }> {
    const found = await this.users.findByConfirmationToken(input.token);
    if (!found) throw new ConfirmationInvalidError();
    if (found.user.emailVerifiedAt) return { email: found.user.email, alreadyConfirmed: true };
    const now = new Date(this.clock.nowIso());
    if (found.expiresAt.getTime() < now.getTime()) throw new ConfirmationInvalidError();
    await this.users.confirmEmail(found.user.id, now);
    return { email: found.user.email, alreadyConfirmed: false };
  }
}
