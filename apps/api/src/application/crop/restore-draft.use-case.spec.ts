import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase } from './publish-crop.use-case';
import { AddVarietyUseCase } from './add-variety.use-case';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { RestoreDraftUseCase } from './restore-draft.use-case';
import { RevisionNotFoundError, NoPublishedVersionError } from '../../domain/crop/crop';
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
import { CropEvent } from '../../domain/crop/crop-event';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputType } from '../../domain/crop/yield-reference';

const clock = { nowIso: () => '2026-07-09T00:00:00.000Z' };
let idSeq = 0;
const ids = { next: () => `var-${++idSeq}` };

/**
 * Brings a crop to 100% completeness by appending section events directly.
 * Pass { includeVariety: false } when a variety was already added via AddVarietyUseCase
 * (to avoid polluting the checkpoint with a duplicate seed variety).
 */
async function seedComplete(events: InMemoryCropEventStore, cropId: string, { includeVariety = true } = {}): Promise<void> {
  const at = clock.nowIso();
  const actor = 'admin';
  const stored = await events.load(cropId);
  const sectionEvents: CropEvent[] = [
    { type: 'ClimaticRequirementsSet', climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } } },
    { type: 'EdaphicRequirementsSet', edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } } },
    { type: 'PhenologySet', phenology: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }] },
    { type: 'NutritionSet', nutrition: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }] },
    { type: 'YieldsSet', yields: [{ inputType: InputType.CHEMICAL, min: 2, average: 4, potential: 6, unit: 't/ha' }] },
    ...(includeVariety ? [{ type: 'VarietyAdded' as const, variety: { id: `v-seed-${cropId}`, cropId, name: { fr: 'Variété seed' }, traits: [] } }] : []),
    { type: 'ZoneSuitabilitySet', suitability: { zoneId: 'z-seed', cropId, rating: 'SUITABLE' as any } },
    { type: 'CroppingWindowAdded', window: { id: `w-seed-${cropId}`, cropId, zoneId: 'z-seed', season: 'Hivernage', irrigationRequired: false, operations: [] } },
    { type: 'PestControlSet', control: { pestId: 'p-seed', cropId, susceptibility: 'HIGH' as any, sensitiveStages: [], controlMethods: [] } },
    { type: 'PricePointAdded', price: { id: `pp-seed-${cropId}`, cropId, market: 'Local', periodStart: '2026-01-01', periodEnd: '2026-01-01', price: 100, unit: 'FCFA/kg', currency: 'XOF' } },
  ];
  await events.append(cropId, stored.length, sectionEvents.map((event) => ({ event, actor, at })));
}

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
    await seedComplete(a.events, 'c1', { includeVariety: false });
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
    await seedComplete(a.events, 'c2');
    await new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published).execute({ id: 'c2', actor: 'admin' });
    const restore = new RestoreDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    await expect(restore.execute({ id: 'c2', revision: 99, actor: 'admin' })).rejects.toThrow(RevisionNotFoundError);
  });

  it('lève NoPublishedVersionError si la culture n\'a jamais été publiée', async () => {
    const a = arrange();
    await createCrop(a, 'c9');
    const restore = new RestoreDraftUseCase(a.events, a.crops, a.varieties, a.windows, a.zones, a.pests, a.prices, a.audit, clock);
    await expect(restore.execute({ id: 'c9', revision: 1, actor: 'admin' })).rejects.toThrow(NoPublishedVersionError);
  });
});
