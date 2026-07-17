import { RegisterUseCase } from './register.use-case';
import { InMemoryUserRepository, InMemoryOrganizationRepository, InMemoryAuthIdentityRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { EmailAlreadyUsedError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function makeRegister() {
  const users = new InMemoryUserRepository();
  const orgs = new InMemoryOrganizationRepository();
  const identities = new InMemoryAuthIdentityRepository();
  const notifier = new FakeNotificationSender();
  return { users, orgs, identities, notifier, uc: new RegisterUseCase(users, orgs, identities, hasher, notifier, clock, ids) };
}

describe('RegisterUseCase', () => {
  beforeEach(() => { n = 0; });

  it('crée org + user admin NON confirmé, sans token, et envoie une confirmation', async () => {
    const { users, notifier, uc } = makeRegister();
    const res = await uc.execute({ email: 'A@B.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    expect(res).toEqual({ email: 'a@b.c' });
    expect((res as Record<string, unknown>).token).toBeUndefined();
    const user = await users.findByEmail('a@b.c');
    expect(user?.role).toBe('admin');
    expect(user?.emailVerifiedAt).toBeNull();
    expect(notifier.sent).toHaveLength(1);
    const sent = notifier.sent[0];
    expect(sent.kind).toBe('email_confirmation');
    expect(sent.kind === 'email_confirmation' ? sent.confirmUrl : '').toContain('/confirm/');
  });

  it('email déjà pris → EmailAlreadyUsedError', async () => {
    const { uc } = makeRegister();
    await uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop' });
    await expect(uc.execute({ email: 'a@b.c', password: 'pw', name: 'A', organizationName: 'Coop2' })).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });
});
