import { CampaignRepository } from './campaign.repository';
import { OperationLogRepository } from './operation-log.repository';
import { CroppingWindowRepository } from '../window/cropping-window.repository';
import { CampaignNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { computeRecommendations, RecommendationsResult } from '../../domain/parcel/recommendations';
import { OperationType } from '../../domain/window/operation-type';

export interface CampaignRecommendations extends RecommendationsResult { hasReference: boolean; }

export class GetCampaignRecommendationsUseCase {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly operations: OperationLogRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { campaignId: string; organizationId: string }): Promise<CampaignRecommendations> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    if (!campaign.cropId || !campaign.windowId) return { hasReference: false, items: [] };
    const windows = await this.windows.listByCrop(campaign.cropId);
    const window = windows.find((w) => w.id === campaign.windowId);
    if (!window) return { hasReference: false, items: [] };
    const journal = await this.operations.listByCampaign(input.organizationId, input.campaignId);
    const sow = journal.filter((o) => o.type === OperationType.PLANTING || o.type === OperationType.NURSERY).map((o) => o.date).sort()[0];
    const anchorDate = sow ?? campaign.startDate;
    const result = computeRecommendations({
      referenceOperations: window.operations.map((op) => ({ type: op.type, label: op.label?.fr ?? op.type, timingDays: op.timingDays })),
      journalOperations: journal.map((o) => ({ type: o.type, date: o.date })),
      anchorDate,
      today: this.clock.nowIso(),
      sowingStart: window.sowingStart,
      sowingEnd: window.sowingEnd,
    });
    return { hasReference: true, ...result };
  }
}
