import { InMemoryUserRepository, InMemoryInvitationRepository } from './in-memory-repositories';

describe('in-memory auth repositories', () => {
  it('User: save + findByEmail', async () => {
    const repo = new InMemoryUserRepository();
    await repo.save({ id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'A', role: 'admin', organizationId: 'o1', createdAt: new Date(), emailVerifiedAt: null });
    expect((await repo.findByEmail('a@b.c'))?.id).toBe('u1');
  });
  it('User: confirmation token set → find → confirm', async () => {
    const repo = new InMemoryUserRepository();
    const exp = new Date(Date.now() + 3600_000);
    await repo.save({ id: 'u2', email: 'c@d.e', firstName: 'C', lastName: 'C', role: 'admin', organizationId: 'o1', createdAt: new Date(), emailVerifiedAt: null });
    await repo.setConfirmationToken('u2', 'tok2', exp);
    const found = await repo.findByConfirmationToken('tok2');
    expect(found?.user.id).toBe('u2');
    expect(found?.expiresAt.getTime()).toBe(exp.getTime());
    await repo.confirmEmail('u2', new Date());
    expect((await repo.findByEmail('c@d.e'))?.emailVerifiedAt).not.toBeNull();
    expect(await repo.findByConfirmationToken('tok2')).toBeNull();
  });
  it('Invitation: findByToken + pending filter', async () => {
    const repo = new InMemoryInvitationRepository();
    await repo.save({ id: 'i1', organizationId: 'o1', email: 'x@y.z', role: 'editor', token: 'tok', status: 'pending', expiresAt: new Date(), invitedByUserId: 'u1', createdAt: new Date(), acceptedAt: null });
    expect((await repo.findByToken('tok'))?.id).toBe('i1');
    expect((await repo.findPendingByEmailAndOrg('x@y.z', 'o1'))?.id).toBe('i1');
  });
});
