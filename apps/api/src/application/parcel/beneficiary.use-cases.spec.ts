import { CreateBeneficiaryUseCase, ListBeneficiariesUseCase, UpdateBeneficiaryUseCase, DeleteBeneficiaryUseCase } from './beneficiary.use-cases';
import { BeneficiaryNotFoundError } from './errors';
import { InMemoryBeneficiaryRepository } from './in-memory-beneficiary.repository';

const clock = { nowIso: () => '2026-08-07T00:00:00.000Z' };
let n = 0; const ids = { next: () => `id${++n}` };

function make() {
  const repo = new InMemoryBeneficiaryRepository();
  return {
    repo,
    create: new CreateBeneficiaryUseCase(repo, clock, ids),
    list: new ListBeneficiariesUseCase(repo),
    update: new UpdateBeneficiaryUseCase(repo),
    del: new DeleteBeneficiaryUseCase(repo),
  };
}

describe('Beneficiary use-cases — isolation par organisation', () => {
  beforeEach(() => { n = 0; });

  it(`create pose organizationId et se relit via listByOrganization`, async () => {
    const { create, list } = make();
    const b = await create.execute({ organizationId: 'o1', name: 'Awa', phone: '+229...' });
    expect(b.organizationId).toBe('o1');
    expect(b.name).toBe('Awa');
    const rows = await list.execute({ organizationId: 'o1' });
    expect(rows.map((r) => r.id)).toEqual([b.id]);
  });

  it(`listByOrganization ne renvoie que l'org demandée`, async () => {
    const { create, list } = make();
    await create.execute({ organizationId: 'o1', name: 'A' });
    await create.execute({ organizationId: 'o2', name: 'B' });
    expect(await list.execute({ organizationId: 'o1' })).toHaveLength(1);
    expect(await list.execute({ organizationId: 'o2' })).toHaveLength(1);
  });

  it(`update/delete d'une autre org → BeneficiaryNotFoundError`, async () => {
    const { create, update, del } = make();
    const b = await create.execute({ organizationId: 'o1', name: 'A' });
    await expect(update.execute({ id: b.id, organizationId: 'o2', name: 'X' })).rejects.toBeInstanceOf(BeneficiaryNotFoundError);
    await expect(del.execute({ id: b.id, organizationId: 'o2' })).rejects.toBeInstanceOf(BeneficiaryNotFoundError);
  });

  it(`update applique les champs ; delete retire`, async () => {
    const { create, update, del, list } = make();
    const b = await create.execute({ organizationId: 'o1', name: 'A' });
    const up = await update.execute({ id: b.id, organizationId: 'o1', name: 'A2', phone: '123' });
    expect(up.name).toBe('A2'); expect(up.phone).toBe('123');
    await del.execute({ id: b.id, organizationId: 'o1' });
    expect(await list.execute({ organizationId: 'o1' })).toHaveLength(0);
  });
});
