import { InvitationRepository } from './repositories';
import { InvitationNotFoundError, ForbiddenOrgError } from './errors';

export class RevokeInvitationUseCase {
  constructor(private readonly invitations: InvitationRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const inv = await this.invitations.findById(input.id);
    if (!inv) throw new InvitationNotFoundError(input.id);
    if (inv.organizationId !== input.organizationId) throw new ForbiddenOrgError();
    await this.invitations.save({ ...inv, status: 'revoked' });
  }
}
