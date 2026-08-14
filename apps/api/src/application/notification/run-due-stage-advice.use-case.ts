import { CampaignRepository } from '../parcel/campaign.repository';

export interface CampaignAdviceSender {
  execute(input: { campaignId: string; organizationId: string; today: string }): Promise<{ sent: number }>;
}

export class RunDueStageAdviceUseCase {
  constructor(private readonly campaigns: CampaignRepository, private readonly sender: CampaignAdviceSender) {}
  async execute(input: { today: string }): Promise<{ campaigns: number; sent: number; failed: number }> {
    const active = await this.campaigns.listActive();
    let sent = 0;
    let failed = 0;
    for (const c of active) {
      try {
        const r = await this.sender.execute({ campaignId: c.id, organizationId: c.organizationId, today: input.today });
        sent += r.sent;
      } catch {
        failed += 1;
      }
    }
    return { campaigns: active.length, sent, failed };
  }
}
