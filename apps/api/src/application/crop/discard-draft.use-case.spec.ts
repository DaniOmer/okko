import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase } from './publish-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { DiscardDraftUseCase } from './discard-draft.use-case';
import { NoPublishedVersionError } from '../../domain/crop/crop';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { InMemoryCropZoneSuitabilityRepository } from '../zone/in-memory-crop-zone-suitability.repository';
import { InMemoryCropPestControlRepository } from '../pest/in-memory-crop-pest-control.repository';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';
import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { CropDocumentComposer } from './compose-crop-document';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-09T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

describe('DiscardDraftUseCase', () => {
  beforeEach(() => { idSeq = 0; });

  function arrange() {
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const windows = new InMemoryCroppingWindowRepository();
    const zones = new InMemoryCropZoneSuitabilityRepository();
    const pests = new InMemoryCropPestControlRepository();
    const prices = new InMemoryPricePointRepository();
    const published = new InMemoryPublishedCropRepository();
    const audit = { record: jest.fn() };
    const composer = new CropDocumentComposer(
      new ListVarietiesUseCase(varieties),
      { execute: async () => [] } as any,
      new ListCroppingWindowsUseCase(windows),
      { execute: async () => [] } as any,
      new ListCropPricesUseCase(prices),
    );
    return { events, crops, varieties, windows, zones, pests, prices, published, audit, composer };
  }

  it('revient à l\'état publié (cœur + variétés) et vide les modifs non publiées', async () => {
    const a = arrange();
    await new CreateCropUseCase(a.events, a.crops, a.audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const addVariety = new AddVarietyUseCase(a.events, a.varieties, a.audit, clock, ids);
    await addVariety.execute({ cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [], actor: 'a' });
    await new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published).execute({ id: 'c1', actor: 'a' });
    await addVariety.execute({ cropId: 'c1', name: { fr: 'Draft-only' }, traits: [], actor: 'a' });
    expect((await new ListVarietiesUseCase(a.varieties).execute({ cropId: 'c1' }))).toHaveLength(2);

    const discard = new DiscardDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    const snap = await discard.execute({ id: 'c1', actor: 'a' });

    expect(snap.hasUnpublishedChanges).toBe(false);
    const list = await new ListVarietiesUseCase(a.varieties).execute({ cropId: 'c1' });
    expect(list.map((v) => v.name.fr)).toEqual(['Obatanpa']);
  });

  it('lève NoPublishedVersionError si jamais publié', async () => {
    const a = arrange();
    await new CreateCropUseCase(a.events, a.crops, a.audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const discard = new DiscardDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    await expect(discard.execute({ id: 'c1', actor: 'a' })).rejects.toThrow(NoPublishedVersionError);
  });
});
