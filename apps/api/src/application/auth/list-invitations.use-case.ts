import { InvitationRepository } from './repositories';
import { Invitation } from './types';

export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationRepository) {}
  async execute(input: { organizationId: string }): Promise<Invitation[]> {
    return this.invitations.listByOrganization(input.organizationId);
  }
}
