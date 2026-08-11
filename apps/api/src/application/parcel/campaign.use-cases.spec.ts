import { CreateCampaignUseCase, ListCampaignsByParcelUseCase, UpdateCampaignUseCase, DeleteCampaignUseCase } from './campaign.use-cases';
import { CampaignNotFoundError, ParcelNotFoundError } from './errors';
import { InMemoryCampaignRepository } from './in-memory-campaign.repository';
import { InMemoryParcelRepository } from './in-memory-parcel.repository';

const clock = { nowIso: () => '2026-08-11T00:00:00.000Z' };

function make() {
  let n = 0; const ids = { next: () => `id${++n}` };
  const repo = new InMemoryCampaignRepository();
  const parcels = new InMemoryParcelRepository();
  return {
    repo, parcels,
    create: new CreateCampaignUseCase(repo, parcels, clock, ids),
    list: new ListCampaignsByParcelUseCase(repo),
    update: new UpdateCampaignUseCase(repo),
    del: new DeleteCampaignUseCase(repo),
  };
}
async function seedParcel(parcels: InMemoryParcelRepository, organizationId: string, id = 'p1') {
  await parcels.save({ id, organizationId, name: 'Champ', createdAt: clock.nowIso() });
  return id;
}

describe('Campaign use-cases — isolation + validation parcelle', () => {
  it('create valide parcelId meme-org, defaut status ACTIVE, se relit', async () => {
    const { create, list, parcels } = make();
    await seedParcel(parcels, 'o1');
    const c = await create.execute({ organizationId: 'o1', parcelId: 'p1', cropId: 'crop1', season: 'Pluies 2026' });
    expect(c.organizationId).toBe('o1');
    expect(c.status).toBe('ACTIVE');
    expect((await list.execute({ organizationId: 'o1', parcelId: 'p1' })).map((x: any) => x.id)).toEqual([c.id]);
  });

  it('create avec parcelId dune autre org throws ParcelNotFoundError', async () => {
    const { create, parcels } = make();
    await seedParcel(parcels, 'o2', 'p-other');
    await expect(create.execute({ organizationId: 'o1', parcelId: 'p-other', cropId: 'crop1', season: 'S' }))
      .rejects.toBeInstanceOf(ParcelNotFoundError);
  });

  it('listByParcel scope org+parcelle', async () => {
    const { create, list, parcels } = make();
    await seedParcel(parcels, 'o1', 'p1'); await seedParcel(parcels, 'o1', 'p2');
    await create.execute({ organizationId: 'o1', parcelId: 'p1', cropId: 'c', season: 'S' });
    await create.execute({ organizationId: 'o1', parcelId: 'p2', cropId: 'c', season: 'S' });
    expect(await list.execute({ organizationId: 'o1', parcelId: 'p1' })).toHaveLength(1);
  });

  it('update/delete dune autre org throws CampaignNotFoundError', async () => {
    const { create, update, del, parcels } = make();
    await seedParcel(parcels, 'o1');
    const c = await create.execute({ organizationId: 'o1', parcelId: 'p1', cropId: 'c', season: 'S' });
    await expect(update.execute({ id: c.id, organizationId: 'o2', season: 'X' })).rejects.toBeInstanceOf(CampaignNotFoundError);
    await expect(del.execute({ id: c.id, organizationId: 'o2' })).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});
