import { RegisterUseCase } from './register.use-case';
import { LoginUseCase } from './login.use-case';
import { InMemoryUserRepository, InMemoryOrganizationRepository, InMemoryAuthIdentityRepository } from './in-memory-repositories';
import { EmailAlreadyUsedError, InvalidCredentialsError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const tokens = { sign: () => 'jwt', verify: () => ({ sub: 'x', email: 'x', role: 'admin' as const, organizationId: null }) };
const clock = { nowIso: () => '2026-07-13T00:00:00Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function makeRegister() {
  const users = new InMemoryUserRepository(); const orgs = new InMemoryOrganizationRepository(); const identities = new InMemoryAuthIdentityRepository();
  return { users, orgs, identities, uc: new RegisterUseCase(users, orgs, identities, hasher, tokens, clock, ids) };
}

describe('RegisterUseCase', () => {
  beforeEach(() => { n = 0; });
  it('crée org + user admin + identity password et renvoie un token', async () => {
    const { users, uc } = makeRegister();
    const { token, user } = await uc.execute({ email: 'A@B.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    expect(token).toBe('jwt');
    expect(user.role).toBe('admin');
    expect(user.email).toBe('a@b.c');
    expect(user.organizationId).not.toBeNull();
    expect((await users.findByEmail('a@b.c'))?.id).toBe(user.id);
  });
  it('email déjà pris → EmailAlreadyUsedError', async () => {
    const { uc } = makeRegister();
    await uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    await expect(uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop2' })).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });
});

describe('LoginUseCase', () => {
  beforeEach(() => { n = 0; });
  it('identifiants valides → token ; invalides → InvalidCredentialsError', async () => {
    const { users, identities, uc: reg } = makeRegister();
    await reg.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    const login = new LoginUseCase(users, identities, hasher, tokens);
    expect((await login.execute({ email: 'a@b.c', password: 'pw' })).token).toBe('jwt');
    await expect(login.execute({ email: 'a@b.c', password: 'bad' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
