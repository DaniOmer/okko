import { CropDocumentComposer } from './compose-crop-document';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';
import { InMemoryVarietyRepository } from './in-memory-variety.repository';
import { InMemoryCroppingWindowRepository } from '../window/in-memory-cropping-window.repository';
import { InMemoryPricePointRepository } from '../price/in-memory-price-point.repository';
import { CropSnapshot } from '../../domain/crop/crop';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

const snap: CropSnapshot = {
  id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
  cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.DRAFT, version: 1, metadata: {},
  hasUnpublishedChanges: false, hasPublishedVersion: false, publishedVersion: 0,
};

// Stubs pour les listes enrichies (zones/pests) : execute renvoie [] .
const zonesStub = { execute: async () => [] } as unknown as import('../zone/list-crop-zones.use-case').ListCropZonesUseCase;
const pestsStub = { execute: async () => [] } as unknown as import('../pest/list-crop-pests.use-case').ListCropPestsUseCase;

describe('CropDocumentComposer', () => {
  it('assemble le document complet avec les variétés de la culture', async () => {
    const varieties = new InMemoryVarietyRepository();
    await varieties.save({ id: 'v1', cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [] });
    const composer = new CropDocumentComposer(
      new ListVarietiesUseCase(varieties),
      zonesStub,
      new ListCroppingWindowsUseCase(new InMemoryCroppingWindowRepository()),
      pestsStub,
      new ListCropPricesUseCase(new InMemoryPricePointRepository()),
    );
    const doc = await composer.compose('c1', snap);
    expect(doc.varieties.map((v) => v.id)).toEqual(['v1']);
    expect(doc.id).toBe('c1');
  });
});
