import { LoginUseCase } from './login.use-case';
import { InMemoryUserRepository, InMemoryAuthIdentityRepository } from './in-memory-repositories';
import { InvalidCredentialsError, EmailNotConfirmedError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const tokens = { sign: () => 'jwt', verify: () => ({ sub: 'x', email: 'x', role: 'admin' as const, organizationId: null }) };
const now = new Date('2026-07-17T00:00:00Z');

async function seed(emailVerifiedAt: Date | null) {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryAuthIdentityRepository();
  await users.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: now, emailVerifiedAt });
  await identities.save({ id: 'i1', userId: 'u1', provider: 'password', identifier: 'a@b.c', secret: await hasher.hash('pw'), createdAt: now });
  return new LoginUseCase(users, identities, hasher, tokens);
}

describe('LoginUseCase', () => {
  it('compte confirmé → token', async () => {
    const uc = await seed(now);
    expect((await uc.execute({ email: 'a@b.c', password: 'pw' })).token).toBe('jwt');
  });
  it('compte NON confirmé → EmailNotConfirmedError', async () => {
    const uc = await seed(null);
    await expect(uc.execute({ email: 'a@b.c', password: 'pw' })).rejects.toBeInstanceOf(EmailNotConfirmedError);
  });
  it('mauvais mot de passe → InvalidCredentialsError', async () => {
    const uc = await seed(now);
    await expect(uc.execute({ email: 'a@b.c', password: 'bad' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
