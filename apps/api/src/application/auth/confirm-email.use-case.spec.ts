import { ConfirmEmailUseCase } from './confirm-email.use-case';
import { InMemoryUserRepository } from './in-memory-repositories';
import { ConfirmationInvalidError } from './errors';

const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
const now = new Date(clock.nowIso());

async function seedUnconfirmed(users: InMemoryUserRepository, token: string, expiresAt: Date) {
  await users.save({ id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt: null });
  await users.setConfirmationToken('u1', token, expiresAt);
}

describe('ConfirmEmailUseCase', () => {
  it('token valide → confirme (emailVerifiedAt posé, token effacé)', async () => {
    const users = new InMemoryUserRepository();
    await seedUnconfirmed(users, 'tok', new Date(now.getTime() + 3600_000));
    const res = await new ConfirmEmailUseCase(users, clock).execute({ token: 'tok' });
    expect(res).toEqual({ email: 'a@b.c', alreadyConfirmed: false });
    expect((await users.findByEmail('a@b.c'))?.emailVerifiedAt).not.toBeNull();
    expect(await users.findByConfirmationToken('tok')).toBeNull();
  });
  it('token inconnu → ConfirmationInvalidError', async () => {
    await expect(new ConfirmEmailUseCase(new InMemoryUserRepository(), clock).execute({ token: 'nope' })).rejects.toBeInstanceOf(ConfirmationInvalidError);
  });
  it('token expiré → ConfirmationInvalidError', async () => {
    const users = new InMemoryUserRepository();
    await seedUnconfirmed(users, 'tok', new Date(now.getTime() - 1000));
    await expect(new ConfirmEmailUseCase(users, clock).execute({ token: 'tok' })).rejects.toBeInstanceOf(ConfirmationInvalidError);
  });
  it('déjà confirmé → alreadyConfirmed (idempotent)', async () => {
    const users = new InMemoryUserRepository();
    await seedUnconfirmed(users, 'tok', new Date(now.getTime() + 3600_000));
    await users.confirmEmail('u1', now);
    // un nouveau token pour retrouver l'utilisateur déjà confirmé
    await users.setConfirmationToken('u1', 'tok2', new Date(now.getTime() + 3600_000));
    const res = await new ConfirmEmailUseCase(users, clock).execute({ token: 'tok2' });
    expect(res.alreadyConfirmed).toBe(true);
  });
});
