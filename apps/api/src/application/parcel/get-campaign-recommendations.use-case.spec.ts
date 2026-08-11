import { GetCampaignRecommendationsUseCase } from './get-campaign-recommendations.use-case';
import { CampaignNotFoundError } from './errors';
import { InMemoryCampaignRepository } from './in-memory-campaign.repository';
import { InMemoryOperationLogRepository } from './in-memory-operation-log.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { OperationType } from '../../domain/window/operation-type';

const clock = { nowIso: () => '2026-05-25T00:00:00.000Z' };

function make() {
  const campaigns = new InMemoryCampaignRepository();
  const operations = new InMemoryOperationLogRepository();
  const windows = new InMemoryCroppingWindowRepository();
  return { campaigns, operations, windows, uc: new GetCampaignRecommendationsUseCase(campaigns, operations, windows, clock) };
}

describe('GetCampaignRecommendationsUseCase', () => {
  it(`garde org : campagne d'une autre org → CampaignNotFoundError`, async () => {
    const { campaigns, uc } = make();
    await campaigns.save({ id: 'c1', organizationId: 'o2', parcelId: 'p1', cropId: 'crop1', windowId: 'w1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
    await expect(uc.execute({ campaignId: 'c1', organizationId: 'o1' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it('sans windowId → hasReference:false', async () => {
    const { campaigns, uc } = make();
    await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
    expect(await uc.execute({ campaignId: 'c1', organizationId: 'o1' })).toEqual({ hasReference: false, items: [] });
  });

  it('nominal : fenêtre + journal → items datés (ancrage = op semis)', async () => {
    const { campaigns, operations, windows, uc } = make();
    await campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', windowId: 'w1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
    await windows.save({ id: 'w1', cropId: 'crop1', zoneId: 'z1', season: 'S', sowingStart: 'MAY', sowingEnd: 'JUL', irrigationRequired: false, operations: [
      { type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] },
      { type: OperationType.WEEDING, label: { fr: 'Sarclage' }, timingDays: 21, inputs: [] },
    ] });
    await operations.save({ id: 'op1', organizationId: 'o1', campaignId: 'c1', type: OperationType.PLANTING, date: '2026-05-01', inputs: [], recordedByUserId: 'u1', createdAt: clock.nowIso() });
    const res = await uc.execute({ campaignId: 'c1', organizationId: 'o1' });
    expect(res.hasReference).toBe(true);
    expect(res.items.find((i) => i.type === OperationType.PLANTING)?.status).toBe('DONE');
    expect(res.items.find((i) => i.type === OperationType.WEEDING)?.dueDate).toBe('2026-05-22');
    expect(res.sowingAdvisory?.withinWindow).toBe(true);
  });
});
