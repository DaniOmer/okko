import { CreateCropUseCase } from './create-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';

const fixedClock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

describe('CreateCropUseCase', () => {
  it('crée une culture DRAFT et l\'enregistre', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    const uc = new CreateCropUseCase(repo, audit, fixedClock);

    const out = await uc.execute({
      id: 'c1',
      commonNames: { fr: 'Carotte' },
      scientificName: 'Daucus carota',
      family: 'Apiaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'expert:omer',
    });

    expect(out.status).toBe(CropStatus.DRAFT);
    expect(await repo.findById('c1')).not.toBeNull();
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});
