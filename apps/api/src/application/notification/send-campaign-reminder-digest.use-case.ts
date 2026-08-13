import { CampaignRepository } from '../parcel/campaign.repository';
import { ParcelRepository } from '../parcel/parcel.repository';
import { UserRepository } from '../auth/repositories';
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationLogRepository } from './notification-log.repository';
import { NotificationPort } from './notification-port';
import { resolveCampaignRecipients } from './campaign-recipients';
import { CampaignNotFoundError } from '../parcel/errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CampaignRecommendationsReader {
  execute(input: { campaignId: string; organizationId: string }): Promise<{ items: { label: string; dueDate?: string; status: string }[] }>;
}
export interface SendReminderResult { sent: number; skipped?: 'no_due_items' | 'no_recipients'; }

function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((Date.parse(bIso.slice(0, 10)) - Date.parse(aIso.slice(0, 10))) / 86400000);
}

export class SendCampaignReminderDigestUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly parcels: ParcelRepository,
    private readonly reco: CampaignRecommendationsReader,
    private readonly users: UserRepository,
    private readonly prefs: NotificationPreferenceRepository,
    private readonly log: NotificationLogRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: { campaignId: string; organizationId: string; today: string }): Promise<SendReminderResult> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    const reco = await this.reco.execute({ campaignId: input.campaignId, organizationId: input.organizationId });
    const items = reco.items.filter((i) => i.status === 'OVERDUE' || i.status === 'DUE_SOON');
    if (items.length === 0) return { sent: 0, skipped: 'no_due_items' };
    const recipients = await resolveCampaignRecipients(this.users, this.prefs, input.organizationId);
    if (recipients.length === 0) return { sent: 0, skipped: 'no_recipients' };
    const parcel = await this.parcels.findById(campaign.parcelId);
    const campaignLabel = `${parcel?.name ?? 'Parcelle'} — ${campaign.season}`;
    const base = process.env.INVITE_BASE_URL ?? 'http://localhost:3000';
    const journalUrl = `${base}/parcelles/${campaign.parcelId}/campagnes/${input.campaignId}`;
    const payloadItems = items.map((i) => ({ label: i.label, dueDate: i.dueDate, status: i.status as 'OVERDUE' | 'DUE_SOON' }));
    let sent = 0;
    for (const r of recipients) {
      const dedupKey = `campaign_reminder:${input.campaignId}:${r.userId}`;
      const last = await this.log.lastSentAt(dedupKey);
      if (last && daysBetween(last, input.today) < r.everyNDays) continue;
      await this.notifier.send({ kind: 'campaign_reminder', to: r.email, campaignLabel, items: payloadItems, journalUrl });
      await this.log.recordSent({ id: this.ids.next(), organizationId: input.organizationId, dedupKey, kind: 'campaign_reminder', sentAt: this.clock.nowIso() });
      sent += 1;
    }
    return { sent };
  }
}
