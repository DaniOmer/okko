import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase } from './publish-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { RestoreDraftUseCase } from './restore-draft.use-case';
import { RevisionNotFoundError } from '../../domain/crop/crop';
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

describe('RestoreDraftUseCase', () => {
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

  async function createCrop(a: ReturnType<typeof arrange>, id: string) {
    await new CreateCropUseCase(a.events, a.crops, a.audit, clock).execute({
      id, commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'admin',
    });
  }

  it('restaure le contenu d\'une révision antérieure dans le brouillon', async () => {
    const a = arrange();
    await createCrop(a, 'c1');
    const addVariety = new AddVarietyUseCase(a.events, a.varieties, a.audit, clock, ids);
    await addVariety.execute({ cropId: 'c1', name: { fr: 'X' }, traits: [], actor: 'admin' });
    const publish = new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published);
    await publish.execute({ id: 'c1', actor: 'admin' });   // rév. 1 = {X}
    await addVariety.execute({ cropId: 'c1', name: { fr: 'Y' }, traits: [], actor: 'admin' });
    await publish.execute({ id: 'c1', actor: 'admin' });   // rév. 2 = {X,Y}

    const restore = new RestoreDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    const snap = await restore.execute({ id: 'c1', revision: 1, actor: 'admin' });

    expect(snap.hasUnpublishedChanges).toBe(true);        // diffère de la rév. 2
    const list = await new ListVarietiesUseCase(a.varieties).execute({ cropId: 'c1' });
    expect(list.map((x) => x.name.fr)).toEqual(['X']);    // projection revenue à la rév. 1
  });

  it('lève RevisionNotFoundError pour une révision inexistante', async () => {
    const a = arrange();
    await createCrop(a, 'c2');
    await new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published).execute({ id: 'c2', actor: 'admin' });
    const restore = new RestoreDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    await expect(restore.execute({ id: 'c2', revision: 99, actor: 'admin' })).rejects.toThrow(RevisionNotFoundError);
  });
});
