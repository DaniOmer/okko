import { CreateParcelUseCase, ListParcelsUseCase, UpdateParcelUseCase, DeleteParcelUseCase } from './parcel.use-cases';
import { ParcelNotFoundError, BeneficiaryNotFoundError } from './errors';
import { InMemoryParcelRepository } from './in-memory-parcel.repository';
import { InMemoryBeneficiaryRepository } from './in-memory-beneficiary.repository';

const clock = { nowIso: () => '2026-08-07T00:00:00.000Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function make() {
  const repo = new InMemoryParcelRepository();
  const bene = new InMemoryBeneficiaryRepository();
  return {
    repo, bene,
    create: new CreateParcelUseCase(repo, bene, clock, ids),
    list: new ListParcelsUseCase(repo),
    update: new UpdateParcelUseCase(repo),
    del: new DeleteParcelUseCase(repo),
  };
}

describe('Parcel use-cases - isolation par organisation', () => {
  beforeEach(() => { n = 0; });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it('create pose organizationId et se relit ; champs optionnels preserves', async () => {
    const { create, list } = make();
    const p = await create.execute({ organizationId: 'o1', name: 'Champ nord', zoneId: 'z1', areaHectares: 1.5 });
    expect(p.organizationId).toBe('o1');
    expect(p.zoneId).toBe('z1'); expect(p.areaHectares).toBe(1.5);
    expect((await list.execute({ organizationId: 'o1' })).map((r: any) => r.id)).toEqual([p.id]);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it('listByOrganization ne renvoie que lorg demandee', async () => {
    const { create, list } = make();
    await create.execute({ organizationId: 'o1', name: 'A' });
    await create.execute({ organizationId: 'o2', name: 'B' });
    expect(await list.execute({ organizationId: 'o1' })).toHaveLength(1);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it('update/delete dune autre org ParcelNotFoundError', async () => {
    const { create, update, del } = make();
    const p = await create.execute({ organizationId: 'o1', name: 'A' });
    await expect(update.execute({ id: p.id, organizationId: 'o2', name: 'X' })).rejects.toBeInstanceOf(ParcelNotFoundError);
    await expect(del.execute({ id: p.id, organizationId: 'o2' })).rejects.toBeInstanceOf(ParcelNotFoundError);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it('create avec beneficiaryId dune autre org BeneficiaryNotFoundError', async () => {
    const { create, bene } = make();
    const other = { id: 'b-other', organizationId: 'o2', name: 'Autre', createdAt: clock.nowIso() };
    await bene.save(other);
    await expect(create.execute({ organizationId: 'o1', name: 'P', beneficiaryId: 'b-other' })).rejects.toBeInstanceOf(BeneficiaryNotFoundError);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it('create avec beneficiaryId de la meme org OK', async () => {
    const { create, bene } = make();
    await bene.save({ id: 'b1', organizationId: 'o1', name: 'Awa', createdAt: clock.nowIso() });
    const p = await create.execute({ organizationId: 'o1', name: 'P', beneficiaryId: 'b1' });
    expect(p.beneficiaryId).toBe('b1');
  });
});
