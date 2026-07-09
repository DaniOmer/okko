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

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

// zones/pests : stubs execute -> []
const composer = new CropDocumentComposer(
  new ListVarietiesUseCase(new InMemoryVarietyRepository()),
  { execute: async () => [] } as any,
  new ListCroppingWindowsUseCase(new InMemoryCroppingWindowRepository()),
  { execute: async () => [] } as any,
  new ListCropPricesUseCase(new InMemoryPricePointRepository()),
);
const published = new InMemoryPublishedCropRepository();

describe('PublishCropUseCase', () => {
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
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    const localPublished = new InMemoryPublishedCropRepository();
    await new CreateCropUseCase(events, crops, audit, clock).execute({
      id: 'c2',
      commonNames: { fr: 'Maïs' },
      scientificName: 'Zea mays',
      family: 'Poaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'a',
    });
    const publish = new PublishCropUseCase(events, crops, audit, clock, composer, localPublished);
    await publish.execute({ id: 'c2', actor: 'a' });
    const rec = await localPublished.findByCrop('c2');
    expect(rec).not.toBeNull();
    expect(rec!.document.id).toBe('c2');
    expect(rec!.version).toBeGreaterThanOrEqual(1);
  });
});
