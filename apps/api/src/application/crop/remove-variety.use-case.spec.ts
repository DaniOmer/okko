import { CreateCropUseCase } from './create-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { RemoveVarietyUseCase } from './remove-variety.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { VarietyNotFoundError } from './update-variety.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { Crop } from '../../domain/crop/crop';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-11T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

describe('RemoveVarietyUseCase', () => {
  let events: InMemoryCropEventStore;
  let crops: InMemoryCropRepository;
  let varieties: InMemoryVarietyRepository;
  let audit: { record: (entry: unknown) => Promise<void>; records: unknown[] };
  let uc: RemoveVarietyUseCase;

  beforeEach(async () => {
    idSeq = 0;
    events = new InMemoryCropEventStore();
    crops = new InMemoryCropRepository();
    varieties = new InMemoryVarietyRepository();
    audit = {
      records: [] as unknown[],
      async record(entry: unknown) { (this.records as unknown[]).push(entry); },
    };
    uc = new RemoveVarietyUseCase(events, varieties, audit, clock);

    await new CreateCropUseCase(events, crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });

    const add = new AddVarietyUseCase(events, varieties, audit, clock, ids);
    await add.execute({ cropId: 'c1', id: 'v1', name: { fr: 'Obatanpa' }, maturityDays: 120, actor: 'a' });
    await add.execute({ cropId: 'c1', id: 'v2', name: { fr: 'Longe' }, maturityDays: 90, actor: 'a' });
  });

  it('culture inconnue → CropNotFoundError', async () => {
    await expect(uc.execute({ cropId: 'ghost', varietyId: 'v1', actor: 'a@b.c' })).rejects.toThrow(CropNotFoundError);
  });

  it('variété inconnue → VarietyNotFoundError', async () => {
    await expect(uc.execute({ cropId: 'c1', varietyId: 'nope', actor: 'a@b.c' })).rejects.toThrow(VarietyNotFoundError);
  });

  it('retire la variété des events ET de la projection', async () => {
    await uc.execute({ cropId: 'c1', varietyId: 'v1', actor: 'a@b.c' });
    const crop = Crop.fromEvents(await events.load('c1'));
    expect(crop.varieties.map((v) => v.id)).toEqual(['v2']);
    expect((await varieties.listByCrop('c1')).map((v) => v.id)).toEqual(['v2']);
    expect(audit.records.at(-1)).toMatchObject({ entityType: 'Variety', entityId: 'v1', changes: { removed: { id: 'v1' } } });
  });
});
