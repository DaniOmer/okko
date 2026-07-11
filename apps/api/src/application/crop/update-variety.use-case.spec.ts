import { CreateCropUseCase } from './create-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { UpdateVarietyUseCase, VarietyNotFoundError } from './update-variety.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-11T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

describe('UpdateVarietyUseCase', () => {
  beforeEach(() => { idSeq = 0; });

  it('met à jour une variété par id (même count, nouvelles valeurs)', async () => {
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const audit = { record: jest.fn() };

    await new CreateCropUseCase(events, crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });

    const add = new AddVarietyUseCase(events, varieties, audit, clock, ids);
    await add.execute({ cropId: 'c1', id: 'v1', name: { fr: 'Obatanpa' }, maturityDays: 120, actor: 'a' });

    const update = new UpdateVarietyUseCase(events, varieties, audit, clock);
    await update.execute({ cropId: 'c1', varietyId: 'v1', name: { fr: 'Obatanpa 2' }, maturityDays: 100, actor: 'a' });

    const list = await varieties.listByCrop('c1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('v1');
    expect(list[0].name.fr).toBe('Obatanpa 2');
    expect(list[0].maturityDays).toBe(100);
    expect(audit.record).toHaveBeenCalledTimes(3); // create + add + update
  });

  it("lève VarietyNotFoundError si l'id n'existe pas", async () => {
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const audit = { record: jest.fn() };

    await new CreateCropUseCase(events, crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });

    const update = new UpdateVarietyUseCase(events, varieties, audit, clock);
    await expect(
      update.execute({ cropId: 'c1', varietyId: 'absent', name: { fr: 'X' }, actor: 'a' }),
    ).rejects.toThrow(VarietyNotFoundError);
  });
});
