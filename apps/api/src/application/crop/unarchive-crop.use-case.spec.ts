import { CreateCropUseCase } from './create-crop.use-case';
import { ArchiveCropUseCase } from './archive-crop.use-case';
import { UnarchiveCropUseCase } from './unarchive-crop.use-case';
import { CropStatusError } from '../../domain/crop/crop-status';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';

const clock = { nowIso: () => '2026-07-12T00:00:00.000Z' };
const audit = { record: jest.fn() };

describe('UnarchiveCropUseCase', () => {
  function arrange() {
    const events = new InMemoryCropEventStore();
    const crops = new InMemoryCropRepository();
    return { events, crops };
  }

  async function createCrop(a: ReturnType<typeof arrange>, id: string) {
    await new CreateCropUseCase(a.events, a.crops, audit, clock).execute({
      id, commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'admin',
    });
  }

  it('désarchive une culture ARCHIVED → statut DRAFT', async () => {
    const a = arrange();
    await createCrop(a, 'c1');
    await new ArchiveCropUseCase(a.events, a.crops, audit, clock).execute({ id: 'c1', actor: 'admin' });
    const uc = new UnarchiveCropUseCase(a.events, a.crops, audit, clock);
    const snap = await uc.execute({ id: 'c1', actor: 'admin' });
    expect(snap.status).toBe(CropStatus.DRAFT);
  });

  it('désarchiver une culture non archivée (DRAFT) → CropStatusError', async () => {
    const a = arrange();
    await createCrop(a, 'c2');
    const uc = new UnarchiveCropUseCase(a.events, a.crops, audit, clock);
    await expect(uc.execute({ id: 'c2', actor: 'admin' })).rejects.toThrow(CropStatusError);
  });
});
