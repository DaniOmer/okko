import { CreateCropUseCase } from './create-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

describe('AddVarietyUseCase', () => {
  it('adds a variety to an existing crop and lists it', async () => {
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });

    const add = new AddVarietyUseCase(crops, varieties, audit, clock, ids);
    const v = await add.execute({ cropId: 'c1', name: { fr: 'Obatanpa' }, maturityDays: 120, traits: ['précoce'], actor: 'a' });
    expect(v.cropId).toBe('c1');
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListVarietiesUseCase(varieties).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].name.fr).toBe('Obatanpa');
  });

  it('throws CropNotFoundError when the crop does not exist', async () => {
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const audit = { record: jest.fn() };
    const add = new AddVarietyUseCase(crops, varieties, audit, clock, ids);
    await expect(add.execute({ cropId: 'nope', name: { fr: 'X' }, actor: 'a' })).rejects.toThrow(CropNotFoundError);
  });
});
