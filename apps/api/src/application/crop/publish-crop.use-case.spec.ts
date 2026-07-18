import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase, CropNotFoundError, IncompleteCropError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';
import { CropDocumentComposer } from './compose-crop-document';
import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';
import { AddVarietyUseCase } from './add-variety.use-case';
import { CropEvent } from '../../domain/crop/crop-event';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputType } from '../../domain/crop/yield-reference';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

// Helper: build a CropDocumentComposer backed by the given variety repo (zones/pests stubbed to [])
function makeComposer(varietyRepo: InMemoryVarietyRepository): CropDocumentComposer {
  return new CropDocumentComposer(
    new ListVarietiesUseCase(varietyRepo),
    { execute: async () => [] } as any,
    new ListCroppingWindowsUseCase(new InMemoryCroppingWindowRepository()),
    { execute: async () => [] } as any,
    new ListCropPricesUseCase(new InMemoryPricePointRepository()),
  );
}

/**
 * Brings a crop to 100% completeness by appending section events directly
 * to the event store (approach b — no zone/pest repos needed in unit tests).
 *
 * Pass { includeVariety: false } when a variety was already added via AddVarietyUseCase
 * (to avoid polluting the aggregate's _varieties checkpoint with a duplicate seed entry).
 */
async function seedComplete(events: InMemoryCropEventStore, cropId: string, { includeVariety = true } = {}): Promise<void> {
  const at = clock.nowIso();
  const actor = 'a';
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
    { type: 'CommercializationSet', commercialization: [{ form: 'GRAIN', saleUnits: ['KG'], outlets: ['Marché local'] }] },
  ];
  await events.append(cropId, stored.length, sectionEvents.map((event) => ({ event, actor, at })));
}

describe('PublishCropUseCase', () => {
  // Each test gets its own fresh instances — no shared mutable state.
  let composer: CropDocumentComposer;
  let published: InMemoryPublishedCropRepository;

  beforeEach(() => {
    composer = makeComposer(new InMemoryVarietyRepository());
    published = new InMemoryPublishedCropRepository();
  });

  it('refuse la publication si la fiche est incomplète (< 100%)', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(events, repo, audit, clock).execute({
      id: 'ci', commonNames: { fr: 'X' }, scientificName: 'X', family: 'X',
      cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    let caught: unknown;
    try {
      await new PublishCropUseCase(events, repo, audit, clock, composer, published).execute({ id: 'ci', actor: 'a' });
    } catch (e) { caught = e; }
    expect((caught as Error).name).toBe('IncompleteCropError');
    expect((caught as any).missing.length).toBeGreaterThan(0);
    expect(await published.findLatest('ci')).toBeNull();
  });

  it('publie une culture existante', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const createAudit = { record: jest.fn() };
    const publishAudit = { record: jest.fn() };
    await new CreateCropUseCase(events, repo, createAudit, clock).execute({
      id: 'c1',
      commonNames: { fr: 'Carotte' },
      scientificName: 'Daucus carota',
      family: 'Apiaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'a',
    });
    await seedComplete(events, 'c1');

    const out = await new PublishCropUseCase(events, repo, publishAudit, clock, composer, published).execute({
      id: 'c1',
      actor: 'a',
    });
    expect(out.status).toBe(CropStatus.PUBLISHED);
    expect(publishAudit.record).toHaveBeenCalledTimes(1);
  });

  it('lève CropNotFoundError si absent', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    let caughtError: unknown;
    try {
      await new PublishCropUseCase(events, repo, audit, clock, composer, published).execute({
        id: 'x',
        actor: 'a',
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(CropNotFoundError);
    expect((caughtError as Error).name).toBe('CropNotFoundError');
  });

  it('publie et fige le document dans PublishedCrop', async () => {
    // Arrange: fresh event store, crop repo, and a variety repo shared by both
    // the AddVariety flow and the composer — so seeded varieties appear in the frozen doc.
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    const localPublished = new InMemoryPublishedCropRepository();

    // Variety repo shared between seeding and the composer
    const varietyRepo = new InMemoryVarietyRepository();
    const localComposer = makeComposer(varietyRepo);

    // Create the crop
    await new CreateCropUseCase(events, crops, audit, clock).execute({
      id: 'c2',
      commonNames: { fr: 'Maïs' },
      scientificName: 'Zea mays',
      family: 'Poaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'a',
    });

    // Seed a variety so the composer produces real content
    const ids = { next: () => 'v1' };
    await new AddVarietyUseCase(events, varietyRepo, audit, clock, ids).execute({
      cropId: 'c2',
      id: 'v1',
      name: { fr: 'Variété test' },
      actor: 'a',
    });

    // Seed completeness — variety already added via AddVarietyUseCase
    await seedComplete(events, 'c2', { includeVariety: false });

    // Act: publish using the composer wired to the seeded variety repo
    const publish = new PublishCropUseCase(events, crops, audit, clock, localComposer, localPublished);
    await publish.execute({ id: 'c2', actor: 'a' });

    // Assert: frozen document must carry real composed content (the seeded variety)
    const rec = await localPublished.findLatest('c2');
    expect(rec).not.toBeNull();
    expect(rec!.document.id).toBe('c2');
    expect(rec!.version).toBeGreaterThanOrEqual(1);
    expect(rec!.revision).toBe(1);
    // Strengthened: the frozen document must contain the seeded variety — rules out an
    // empty/broken composer silently passing because the variety repo was empty.
    expect(rec!.document.varieties.length).toBeGreaterThan(0);
    expect(rec!.document.varieties[0].id).toBe('v1');
  });

  it('incrémente la révision à chaque publication', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(events, repo, audit, clock).execute({
      id: 'c3',
      commonNames: { fr: 'Blé' },
      scientificName: 'Triticum aestivum',
      family: 'Poaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'a',
    });
    await seedComplete(events, 'c3');
    const uc = new PublishCropUseCase(events, repo, audit, clock, composer, published);
    const out1 = await uc.execute({ id: 'c3', actor: 'admin' }); // 1re
    expect(out1.publishedVersion).toBe(1);
    const out2 = await uc.execute({ id: 'c3', actor: 'admin' }); // republication (PUBLISHED->PUBLISHED autorisé)
    expect(out2.publishedVersion).toBe(2);
    expect((await published.findLatest('c3'))!.revision).toBe(2);
    expect((await published.listByCrop('c3')).map((v) => v.revision)).toEqual([2, 1]);
  });

  it('enregistre la note de publication (vide -> null)', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const publishAudit = { record: jest.fn() };
    await new CreateCropUseCase(events, repo, publishAudit, clock).execute({
      id: 'c4',
      commonNames: { fr: 'Sorgho' },
      scientificName: 'Sorghum bicolor',
      family: 'Poaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'a',
    });
    await seedComplete(events, 'c4');
    const uc = new PublishCropUseCase(events, repo, publishAudit, clock, composer, published);
    await uc.execute({ id: 'c4', actor: 'admin', note: '  MAJ prix  ' });
    expect((await published.findLatest('c4'))!.note).toBe('MAJ prix'); // trim
    // republier sans note -> null
    await uc.execute({ id: 'c4', actor: 'admin' });
    expect((await published.findLatest('c4'))!.note).toBeNull();
    // note vide -> null
    await uc.execute({ id: 'c4', actor: 'admin', note: '   ' });
    expect((await published.findLatest('c4'))!.note).toBeNull();
  });
});
