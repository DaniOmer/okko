import { CreateInvitationUseCase } from './create-invitation.use-case';
import { InvalidRoleForOrgError } from './errors';
import { InMemoryInvitationRepository, InMemoryOrganizationRepository, InMemoryUserRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';

const clock = { nowIso: () => '2026-08-05T00:00:00Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function make() {
  const invitations = new InMemoryInvitationRepository();
  const orgs = new InMemoryOrganizationRepository();
  const users = new InMemoryUserRepository();
  const notifier = new FakeNotificationSender();
  return { invitations, orgs, users, uc: new CreateInvitationUseCase(invitations, orgs, users, notifier, clock, ids) };
}

describe('CreateInvitationUseCase — rôle scopé par org.kind', () => {
  beforeEach(() => { n = 0; });

  it('org CUSTOMER : accepte un rôle tenant et le persiste', async () => {
    const { orgs, invitations, uc } = make();
    await orgs.save({ id: 'o1', name: 'Coop', kind: 'CUSTOMER', createdAt: new Date(clock.nowIso()) });
    const { invitation } = await uc.execute({ organizationId: 'o1', email: 'x@y.z', invitedByUserId: 'u1', role: 'AGRONOMIST' });
    expect(invitation.role).toBe('AGRONOMIST');
    expect((await invitations.findById(invitation.id))?.role).toBe('AGRONOMIST');
  });

  it('org CUSTOMER : rejette un rôle plateforme', async () => {
    const { orgs, uc } = make();
    await orgs.save({ id: 'o1', name: 'Coop', kind: 'CUSTOMER', createdAt: new Date(clock.nowIso()) });
    await expect(uc.execute({ organizationId: 'o1', email: 'x@y.z', invitedByUserId: 'u1', role: 'editor' }))
      .rejects.toBeInstanceOf(InvalidRoleForOrgError);
  });
});
