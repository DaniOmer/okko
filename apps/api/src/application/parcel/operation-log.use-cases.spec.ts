import { CreateOperationLogUseCase, ListOperationsByCampaignUseCase, UpdateOperationLogUseCase, DeleteOperationLogUseCase } from './operation-log.use-cases';
import { OperationLogNotFoundError, CampaignNotFoundError } from './errors';
import { InMemoryOperationLogRepository } from './in-memory-operation-log.repository';
import { InMemoryCampaignRepository } from './in-memory-campaign.repository';
import { OperationType } from '../../domain/window/operation-type';

const clock = { nowIso: () => '2026-08-11T00:00:00.000Z' };

function make() {
  let n = 0; const ids = { next: () => `id${++n}` };
  const repo = new InMemoryOperationLogRepository();
  const campaigns = new InMemoryCampaignRepository();
  return {
    repo, campaigns,
    create: new CreateOperationLogUseCase(repo, campaigns, clock, ids),
    list: new ListOperationsByCampaignUseCase(repo),
    update: new UpdateOperationLogUseCase(repo),
    del: new DeleteOperationLogUseCase(repo),
  };
}
async function seedCampaign(campaigns: InMemoryCampaignRepository, organizationId: string, id = 'c1') {
  await campaigns.save({ id, organizationId, parcelId: 'p1', cropId: 'crop1', season: 'S', status: 'ACTIVE', createdAt: clock.nowIso() });
  return id;
}

describe('OperationLog use-cases — isolation + validation campagne', () => {
  it('create valide campaignId meme-org, pose recordedByUserId, inputs conserves', async () => {
    const { create, list, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.FERTILIZATION, date: '2026-05-12', recordedByUserId: 'u1', inputs: [{ product: 'Uree', quantity: 50, unit: 'kg' }], laborCost: 10 });
    expect(op.recordedByUserId).toBe('u1');
    expect(op.inputs).toEqual([{ product: 'Uree', quantity: 50, unit: 'kg' }]);
    expect((await list.execute({ organizationId: 'o1', campaignId: 'c1' })).map((x: any) => x.id)).toEqual([op.id]);
  });

  it('create avec campaignId dune autre org CampaignNotFoundError', async () => {
    const { create, campaigns } = make();
    await seedCampaign(campaigns, 'o2', 'c-other');
    await expect(create.execute({ organizationId: 'o1', campaignId: 'c-other', type: OperationType.WEEDING, date: '2026-05-01', recordedByUserId: 'u1' }))
      .rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it('update/delete dune autre org OperationLogNotFoundError', async () => {
    const { create, update, del, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.HARVEST, date: '2026-09-01', recordedByUserId: 'u1' });
    await expect(update.execute({ id: op.id, organizationId: 'o2', notes: 'x' })).rejects.toBeInstanceOf(OperationLogNotFoundError);
    await expect(del.execute({ id: op.id, organizationId: 'o2' })).rejects.toBeInstanceOf(OperationLogNotFoundError);
  });

  it('create persiste photos + gpsLat/gpsLng et se relit (round-trip)', async () => {
    const { create, list, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.PLANTING, date: '2026-05-01', recordedByUserId: 'u1', photos: [{ key: 'images/a.jpg', caption: 'plant' }], gpsLat: 6.37, gpsLng: 2.42 });
    expect(op.photos).toEqual([{ key: 'images/a.jpg', caption: 'plant' }]);
    expect(op.gpsLat).toBe(6.37);
    expect(op.gpsLng).toBe(2.42);
    const relu = await list.execute({ organizationId: 'o1', campaignId: 'c1' });
    expect(relu[0].photos).toEqual([{ key: 'images/a.jpg', caption: 'plant' }]);
    expect(relu[0].gpsLat).toBe(6.37);
    expect(relu[0].gpsLng).toBe(2.42);
  });

  it('create sans photos → photos: []', async () => {
    const { create, campaigns } = make();
    await seedCampaign(campaigns, 'o1');
    const op = await create.execute({ organizationId: 'o1', campaignId: 'c1', type: OperationType.WEEDING, date: '2026-05-01', recordedByUserId: 'u1' });
    expect(op.photos).toEqual([]);
  });
});
