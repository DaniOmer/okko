import { CampaignRepository } from '../parcel/campaign.repository';
import { OperationLogRepository } from '../parcel/operation-log.repository';
import { PublishedCropRepository } from '../crop/published-crop.repository';
import { resolveCampaignStageAdvice } from './campaign-stage-advice';
import { CampaignNotFoundError } from '../parcel/errors';
import { Clock } from '../shared/clock';

export class GetCampaignStageAdviceUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly published: PublishedCropRepository,
    private readonly operations: OperationLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { campaignId: string; organizationId: string }): Promise<{ stageName: string; advice: string } | null> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    if (!campaign.cropId) return null;
    const published = await this.published.findLatest(campaign.cropId);
    if (!published) return null;
    const journal = await this.operations.listByCampaign(input.organizationId, input.campaignId);
    return resolveCampaignStageAdvice(campaign, published.document.phenology ?? [], journal, this.clock.nowIso());
  }
}
