import { InvitationRepository, OrganizationRepository, UserRepository } from './repositories';
import { NotificationPort } from '../notification/notification-port';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { EmailAlreadyUsedError } from './errors';
import { Invitation } from './types';

export const INVITATION_TTL_DAYS = 7;

export interface CreateInvitationInput { organizationId: string; email: string; invitedByUserId: string; }

export class CreateInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly orgs: OrganizationRepository,
    private readonly users: UserRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateInvitationInput): Promise<{ invitation: Invitation; emailSent: boolean }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) throw new EmailAlreadyUsedError(email);
    const now = new Date(this.clock.nowIso());
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const invitation: Invitation = {
      id: this.ids.next(), organizationId: input.organizationId, email, role: 'editor',
      token: this.ids.next(), status: 'pending', expiresAt, invitedByUserId: input.invitedByUserId, createdAt: now, acceptedAt: null,
    };
    await this.invitations.save(invitation);
    const org = await this.orgs.findById(input.organizationId);
    const inviteUrl = `${process.env.INVITE_BASE_URL ?? 'http://localhost:3000'}/invite/${invitation.token}`;
    let emailSent = true;
    try {
      await this.notifier.send({ kind: 'invitation', to: email, organizationName: org?.name ?? 'Okko', inviteUrl, expiresAt });
    } catch { emailSent = false; }
    return { invitation, emailSent };
  }
}
