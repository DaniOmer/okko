import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase } from './publish-crop.use-case';
import { ArchiveCropUseCase } from './archive-crop.use-case';
import { CropStatusError } from '../../domain/crop/crop-status';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { CropDocumentComposer } from './compose-crop-document';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';
import { CropEvent } from '../../domain/crop/crop-event';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputType } from '../../domain/crop/yield-reference';

const clock = { nowIso: () => '2026-07-12T00:00:00.000Z' };
const ids = { next: () => 'var-1' };

async function seedComplete(events: InMemoryCropEventStore, cropId: string): Promise<void> {
  const at = clock.nowIso();
  const actor = 'admin';
  const stored = await events.load(cropId);
  const sectionEvents: CropEvent[] = [
    { type: 'ClimaticRequirementsSet', climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } } },
    { type: 'EdaphicRequirementsSet', edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } } },
    { type: 'PhenologySet', phenology: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }] },
    { type: 'NutritionSet', nutrition: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }] },
    { type: 'YieldsSet', yields: [{ inputType: InputType.CHEMICAL, min: 2, average: 4, potential: 6, unit: 't/ha' }] },
    { type: 'VarietyAdded', variety: { id: `v-seed-${cropId}`, cropId, name: { fr: 'Variété seed' }, traits: [] } },
    { type: 'ZoneSuitabilitySet', suitability: { zoneId: 'z-seed', cropId, rating: 'SUITABLE' as any } },
    { type: 'CroppingWindowAdded', window: { id: `w-seed-${cropId}`, cropId, zoneId: 'z-seed', season: 'Hivernage', irrigationRequired: false, operations: [] } },
    { type: 'PestControlSet', control: { pestId: 'p-seed', cropId, susceptibility: 'HIGH' as any, sensitiveStages: [], controlMethods: [] } },
    { type: 'PricePointAdded', price: { id: `pp-seed-${cropId}`, cropId, market: 'Local', periodStart: '2026-01-01', periodEnd: '2026-01-01', price: 100, unit: 'FCFA/kg', currency: 'XOF' } },
    { type: 'CommercializationSet', commercialization: [{ form: 'GRAIN', saleUnits: ['KG'], outlets: ['Marché local'] }] },
  ];
  await events.append(cropId, stored.length, sectionEvents.map((event) => ({ event, actor, at })));
}

describe('ArchiveCropUseCase', () => {
  function arrange() {
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const varieties = new InMemoryVarietyRepository();
    const windows = new InMemoryCroppingWindowRepository();
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
    return { events, crops, varieties, windows, prices, published, audit, composer };
  }

  async function createCrop(a: ReturnType<typeof arrange>, id: string) {
    await new CreateCropUseCase(a.events, a.crops, a.audit, clock).execute({
      id, commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'admin',
    });
  }

  it('archive une culture DRAFT → statut ARCHIVED', async () => {
    const a = arrange();
    await createCrop(a, 'c1');
    const uc = new ArchiveCropUseCase(a.events, a.crops, a.audit, clock);
    const snap = await uc.execute({ id: 'c1', actor: 'admin' });
    expect(snap.status).toBe(CropStatus.ARCHIVED);
  });

  it('archive une culture PUBLISHED → statut ARCHIVED', async () => {
    const a = arrange();
    await createCrop(a, 'c2');
    await seedComplete(a.events, 'c2');
    const publish = new PublishCropUseCase(a.events, a.crops, a.audit, clock, a.composer, a.published);
    await publish.execute({ id: 'c2', actor: 'admin' });
    const uc = new ArchiveCropUseCase(a.events, a.crops, a.audit, clock);
    const snap = await uc.execute({ id: 'c2', actor: 'admin' });
    expect(snap.status).toBe(CropStatus.ARCHIVED);
  });

  it('archiver une culture déjà archivée → CropStatusError', async () => {
    const a = arrange();
    await createCrop(a, 'c3');
    const uc = new ArchiveCropUseCase(a.events, a.crops, a.audit, clock);
    await uc.execute({ id: 'c3', actor: 'admin' });
    await expect(uc.execute({ id: 'c3', actor: 'admin' })).rejects.toThrow(CropStatusError);
  });
});
