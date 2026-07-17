import { GetInvitationByTokenUseCase } from './get-invitation-by-token.use-case';
import { InMemoryInvitationRepository, InMemoryOrganizationRepository } from './in-memory-repositories';
import { InvitationNotFoundError } from './errors';
import { Invitation } from './types';

const clock = { nowIso: () => '2026-07-17T00:00:00Z' };
const now = new Date(clock.nowIso());

function inv(partial: Partial<Invitation>): Invitation {
  return { id: 'i1', organizationId: 'o1', email: 'x@y.z', role: 'editor', token: 'tok', status: 'pending', expiresAt: new Date(now.getTime() + 3600_000), invitedByUserId: 'u1', createdAt: now, acceptedAt: null, ...partial };
}

async function make(partial: Partial<Invitation>) {
  const invitations = new InMemoryInvitationRepository();
  const orgs = new InMemoryOrganizationRepository();
  await orgs.save({ id: 'o1', name: 'Coop', createdAt: now });
  await invitations.save(inv(partial));
  return new GetInvitationByTokenUseCase(invitations, orgs, clock);
}

describe('GetInvitationByTokenUseCase', () => {
  it('pending non expiré → email + org + acceptable:true', async () => {
    const uc = await make({});
    expect(await uc.execute({ token: 'tok' })).toEqual({ email: 'x@y.z', organizationName: 'Coop', acceptable: true });
  });
  it('expiré → acceptable:false', async () => {
    const uc = await make({ expiresAt: new Date(now.getTime() - 1000) });
    expect((await uc.execute({ token: 'tok' })).acceptable).toBe(false);
  });
  it('déjà accepté → acceptable:false', async () => {
    const uc = await make({ status: 'accepted' });
    expect((await uc.execute({ token: 'tok' })).acceptable).toBe(false);
  });
  it('token introuvable → InvitationNotFoundError', async () => {
    const uc = await make({});
    await expect(uc.execute({ token: 'nope' })).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
