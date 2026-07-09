import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from './publish-crop.use-case';
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

describe('PublishCropUseCase', () => {
  // Each test gets its own fresh instances — no shared mutable state.
  let composer: CropDocumentComposer;
  let published: InMemoryPublishedCropRepository;

  beforeEach(() => {
    composer = makeComposer(new InMemoryVarietyRepository());
    published = new InMemoryPublishedCropRepository();
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

    // Act: publish using the composer wired to the seeded variety repo
    const publish = new PublishCropUseCase(events, crops, audit, clock, localComposer, localPublished);
    await publish.execute({ id: 'c2', actor: 'a' });

    // Assert: frozen document must carry real composed content (the seeded variety)
    const rec = await localPublished.findByCrop('c2');
    expect(rec).not.toBeNull();
    expect(rec!.document.id).toBe('c2');
    expect(rec!.version).toBeGreaterThanOrEqual(1);
    // Strengthened: the frozen document must contain the seeded variety — rules out an
    // empty/broken composer silently passing because the variety repo was empty.
    expect(rec!.document.varieties.length).toBeGreaterThan(0);
    expect(rec!.document.varieties[0].id).toBe('v1');
  });
});
