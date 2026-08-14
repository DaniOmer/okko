import { GetCampaignStageAdviceUseCase } from './get-campaign-stage-advice.use-case';
import { InMemoryCampaignRepository } from '../parcel/in-memory-campaign.repository';
import { InMemoryOperationLogRepository } from '../parcel/in-memory-operation-log.repository';
import { InMemoryPublishedCropRepository } from '../crop/in-memory-published-crop.repository';
import { CampaignNotFoundError } from '../parcel/errors';
import type { CropDocument } from '../crop/crop-read-model';
import type { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';

const PHENO: PhenologicalStageJSON[] = [{ name: { fr: 'Floraison' }, startDay: 50, endDay: 65, order: 1, recommendedWork: 'Surveiller les pucerons.' }];
const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };

function make() {
  const campaigns = new InMemoryCampaignRepository();
  const ops = new InMemoryOperationLogRepository();
  const published = new InMemoryPublishedCropRepository();
  const uc = new GetCampaignStageAdviceUseCase(campaigns, published, ops, clock);
  return { campaigns, published, uc };
}

describe('GetCampaignStageAdviceUseCase', () => {
  it('renvoie le conseil du stade courant', async () => {
    const m = make();
    await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'S', startDate: '2026-06-19', status: 'ACTIVE', createdAt: '' });
    await m.published.save({ cropId: 'crop1', revision: 1, document: { phenology: PHENO } as unknown as CropDocument, version: 1, publishedAt: '', publishedBy: '', note: null });
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1' })).toEqual({ stageName: 'Floraison', advice: 'Surveiller les pucerons.' });
  });
  it('null si pas de cropId', async () => {
    const m = make();
    await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', season: 'S', startDate: '2026-06-19', status: 'ACTIVE', createdAt: '' });
    expect(await m.uc.execute({ campaignId: 'c1', organizationId: 'o1' })).toBeNull();
  });
  it("garde org → CampaignNotFoundError", async () => {
    const m = make();
    await m.campaigns.save({ id: 'c1', organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'S', startDate: '2026-06-19', status: 'ACTIVE', createdAt: '' });
    await expect(m.uc.execute({ campaignId: 'c1', organizationId: 'oX' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
