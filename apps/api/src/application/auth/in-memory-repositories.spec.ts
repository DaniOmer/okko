import { InMemoryUserRepository, InMemoryInvitationRepository } from './in-memory-repositories';

describe('in-memory auth repositories', () => {
  it('User: save + findByEmail', async () => {
    const repo = new InMemoryUserRepository();
    await repo.save({ id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', organizationId: 'o1', createdAt: new Date() });
    expect((await repo.findByEmail('a@b.c'))?.id).toBe('u1');
  });
  it('Invitation: findByToken + pending filter', async () => {
    const repo = new InMemoryInvitationRepository();
    await repo.save({ id: 'i1', organizationId: 'o1', email: 'x@y.z', role: 'editor', token: 'tok', status: 'pending', expiresAt: new Date(), invitedByUserId: 'u1', createdAt: new Date(), acceptedAt: null });
    expect((await repo.findByToken('tok'))?.id).toBe('i1');
    expect((await repo.findPendingByEmailAndOrg('x@y.z', 'o1'))?.id).toBe('i1');
  });
});
