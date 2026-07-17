import { ResendConfirmationUseCase } from './resend-confirmation.use-case';
import { InMemoryUserRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';

const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
const now = new Date(clock.nowIso());
let n = 0; const ids = { next: () => `id${++n}` };

describe('ResendConfirmationUseCase', () => {
  beforeEach(() => { n = 0; });

  it('compte non confirmé → nouveau token + notification', async () => {
    const users = new InMemoryUserRepository();
    await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt: null });
    const notifier = new FakeNotificationSender();
    await new ResendConfirmationUseCase(users, notifier, clock, ids).execute({ email: 'A@B.c' });
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].kind).toBe('email_confirmation');
  });
  it('compte inexistant → aucun effet, aucune notification', async () => {
    const users = new InMemoryUserRepository();
    const notifier = new FakeNotificationSender();
    await new ResendConfirmationUseCase(users, notifier, clock, ids).execute({ email: 'ghost@x.z' });
    expect(notifier.sent).toHaveLength(0);
  });
  it('compte déjà confirmé → aucun effet', async () => {
    const users = new InMemoryUserRepository();
    await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt: now });
    const notifier = new FakeNotificationSender();
    await new ResendConfirmationUseCase(users, notifier, clock, ids).execute({ email: 'a@b.c' });
    expect(notifier.sent).toHaveLength(0);
  });
});
