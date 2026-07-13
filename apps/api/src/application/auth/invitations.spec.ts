import { CreateInvitationUseCase } from './create-invitation.use-case';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';
import { InMemoryUserRepository, InMemoryOrganizationRepository, InMemoryAuthIdentityRepository, InMemoryInvitationRepository } from './in-memory-repositories';
import { FakeNotificationSender } from '../../infrastructure/notification/fake-notification-sender';
import { ForbiddenOrgError, InvitationInvalidError } from './errors';

const hasher = { hash: async (p: string) => `h:${p}`, verify: async (p: string, h: string) => h === `h:${p}` };
const tokens = { sign: () => 'jwt', verify: () => ({ sub: 'x', email: 'x', role: 'editor' as const, organizationId: null }) };
const clock = { nowIso: () => '2026-07-13T00:00:00Z' };
const orgDate = new Date(clock.nowIso());
let n = 0; const ids = { next: () => `id${++n}` };

function setup() {
  const users = new InMemoryUserRepository(); const orgs = new InMemoryOrganizationRepository();
  const identities = new InMemoryAuthIdentityRepository(); const invitations = new InMemoryInvitationRepository();
  const notifier = new FakeNotificationSender();
  return { users, orgs, identities, invitations, notifier };
}

describe('invitations', () => {
  beforeEach(() => { n = 0; });

  it('create: crée une invitation pending dans l\'org et notifie', async () => {
    const s = setup();
    await s.orgs.save({ id: 'o1', name: 'Coop', createdAt: orgDate });
    const create = new CreateInvitationUseCase(s.invitations, s.orgs, s.users, s.notifier, clock, ids);
    const { invitation, emailSent } = await create.execute({ organizationId: 'o1', email: 'X@Y.z', invitedByUserId: 'admin1' });
    expect(invitation.status).toBe('pending');
    expect(invitation.email).toBe('x@y.z');
    expect(emailSent).toBe(true);
    expect(s.notifier.sent[0].inviteUrl).toContain(invitation.token);
  });

  it('accept: crée un editor dans la bonne org ; token à usage unique', async () => {
    const s = setup();
    await s.orgs.save({ id: 'o1', name: 'Coop', createdAt: orgDate });
    const create = new CreateInvitationUseCase(s.invitations, s.orgs, s.users, s.notifier, clock, ids);
    const { invitation } = await create.execute({ organizationId: 'o1', email: 'e@x.z', invitedByUserId: 'admin1' });
    const accept = new AcceptInvitationUseCase(s.invitations, s.users, s.identities, hasher, tokens, clock, ids);
    const { user } = await accept.execute({ token: invitation.token, name: 'E', password: 'pw' });
    expect(user.role).toBe('editor');
    expect(user.organizationId).toBe('o1');
    await expect(accept.execute({ token: invitation.token, name: 'E', password: 'pw' })).rejects.toBeInstanceOf(InvitationInvalidError);
  });

  it('revoke: refuse une invitation d\'une autre org (ForbiddenOrgError)', async () => {
    const s = setup();
    await s.orgs.save({ id: 'o1', name: 'Coop', createdAt: orgDate });
    const create = new CreateInvitationUseCase(s.invitations, s.orgs, s.users, s.notifier, clock, ids);
    const { invitation } = await create.execute({ organizationId: 'o1', email: 'e@x.z', invitedByUserId: 'admin1' });
    const revoke = new RevokeInvitationUseCase(s.invitations);
    await expect(revoke.execute({ id: invitation.id, organizationId: 'AUTRE' })).rejects.toBeInstanceOf(ForbiddenOrgError);
  });
});
