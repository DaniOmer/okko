import { RunDueStageAdviceUseCase, CampaignAdviceSender } from './run-due-stage-advice.use-case';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';

const senderOf = (impl: CampaignAdviceSender['execute']): CampaignAdviceSender => ({ execute: impl });
async function seed(campaigns: InMemoryCampaignRepository) {
  await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', season: 'S', status: 'ACTIVE', createdAt: '' });
  await campaigns.save({ id: 'c2', organizationId: 'o2', parcelId: 'p2', season: 'S', status: 'ACTIVE', createdAt: '' });
  await campaigns.save({ id: 'c3', organizationId: 'o1', parcelId: 'p3', season: 'S', status: 'CLOSED', createdAt: '' });
}

describe('RunDueStageAdviceUseCase', () => {
  it('parcourt les campagnes ACTIVE (toutes orgs) et agrège sent', async () => {
    const campaigns = new InMemoryCampaignRepository();
    await seed(campaigns);
    const uc = new RunDueStageAdviceUseCase(campaigns, senderOf(async () => ({ sent: 1 })));
    expect(await uc.execute({ today: '2026-08-13T00:00:00.000Z' })).toEqual({ campaigns: 2, sent: 2, failed: 0 });
  });
  it("une campagne dont l'envoi lève n'interrompt pas le passage", async () => {
    const campaigns = new InMemoryCampaignRepository();
    await seed(campaigns);
    const uc = new RunDueStageAdviceUseCase(campaigns, senderOf(async (i) => { if (i.campaignId === 'c1') throw new Error('boom'); return { sent: 1 }; }));
    expect(await uc.execute({ today: '2026-08-13T00:00:00.000Z' })).toEqual({ campaigns: 2, sent: 1, failed: 1 });
  });
});
