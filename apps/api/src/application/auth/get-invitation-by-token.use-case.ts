import { InvitationRepository, OrganizationRepository } from './repositories';
import { Clock } from '../shared/clock';
import { InvitationNotFoundError } from './errors';

export class GetInvitationByTokenUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly orgs: OrganizationRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { token: string }): Promise<{ email: string; organizationName: string; acceptable: boolean }> {
    const inv = await this.invitations.findByToken(input.token);
    if (!inv) throw new InvitationNotFoundError(input.token);
    const org = await this.orgs.findById(inv.organizationId);
    const now = new Date(this.clock.nowIso());
    const acceptable = inv.status === 'pending' && inv.expiresAt.getTime() > now.getTime();
    return { email: inv.email, organizationName: org?.name ?? 'Okko', acceptable };
  }
}
