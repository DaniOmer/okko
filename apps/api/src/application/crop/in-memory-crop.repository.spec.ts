import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

it('porte publishedVersion au round-trip', async () => {
  const repo = new InMemoryCropRepository();
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.DRAFT, version: 3, metadata: {},
    hasUnpublishedChanges: false, hasPublishedVersion: true, publishedVersion: 2,
  } as any;
  await repo.save(snap);
  expect((await repo.findById('c1'))!.publishedVersion).toBe(2);
  expect((await repo.list())[0].publishedVersion).toBe(2);
});
