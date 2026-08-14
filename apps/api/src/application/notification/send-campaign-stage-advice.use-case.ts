import { CampaignRepository } from '../parcel/campaign.repository';
import { ParcelRepository } from '../parcel/parcel.repository';
import { OperationLogRepository } from '../parcel/operation-log.repository';
import { PublishedCropRepository } from '../crop/published-crop.repository';
import { UserRepository } from '../auth/repositories';
import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationLogRepository } from './notification-log.repository';
import { NotificationPort } from './notification-port';
import { resolveCampaignRecipients } from './campaign-recipients';
import { resolveCampaignStageAdvice } from './campaign-stage-advice';
import { daysBetween } from '../shared/days';
import { CampaignNotFoundError } from '../parcel/errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface StageAdviceResult { sent: number; skipped?: 'no_reference' | 'no_advice' | 'no_recipients'; }

export class SendCampaignStageAdviceUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly parcels: ParcelRepository,
    private readonly published: PublishedCropRepository,
    private readonly operations: OperationLogRepository,
    private readonly users: UserRepository,
    private readonly prefs: NotificationPreferenceRepository,
    private readonly log: NotificationLogRepository,
    private readonly notifier: NotificationPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: { campaignId: string; organizationId: string; today: string }): Promise<StageAdviceResult> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    if (!campaign.cropId) return { sent: 0, skipped: 'no_reference' };
    const published = await this.published.findLatest(campaign.cropId);
    if (!published) return { sent: 0, skipped: 'no_reference' };
    const journal = await this.operations.listByCampaign(input.organizationId, input.campaignId);
    const advice = resolveCampaignStageAdvice(campaign, published.document.phenology ?? [], journal, input.today);
    if (!advice) return { sent: 0, skipped: 'no_advice' };
    const recipients = await resolveCampaignRecipients(this.users, this.prefs, input.organizationId);
    if (recipients.length === 0) return { sent: 0, skipped: 'no_recipients' };
    const parcel = await this.parcels.findById(campaign.parcelId);
    const campaignLabel = `${parcel?.name ?? 'Parcelle'} — ${campaign.season}`;
    const base = process.env.INVITE_BASE_URL ?? 'http://localhost:3000';
    const journalUrl = `${base}/parcelles/${campaign.parcelId}/campagnes/${input.campaignId}`;
    let sent = 0;
    for (const r of recipients) {
      const dedupKey = `campaign_advice:${input.campaignId}:${r.userId}`;
      const last = await this.log.lastSentAt(dedupKey);
      if (last && daysBetween(last, input.today) < r.everyNDays) continue;
      await this.notifier.send({ kind: 'campaign_advice', to: r.email, campaignLabel, stageName: advice.stageName, advice: advice.advice, journalUrl });
      await this.log.recordSent({ id: this.ids.next(), organizationId: input.organizationId, dedupKey, kind: 'campaign_advice', sentAt: this.clock.nowIso() });
      sent += 1;
    }
    return { sent };
  }
}
