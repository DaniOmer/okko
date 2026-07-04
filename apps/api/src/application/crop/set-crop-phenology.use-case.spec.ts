import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropPhenologyUseCase } from './set-crop-phenology.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

describe('SetCropPhenologyUseCase', () => {
  it('sets phenology and audits', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(repo, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const out = await new SetCropPhenologyUseCase(repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      stages: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }],
    });
    expect(out.phenology).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();
  });

  it('throws CropNotFoundError when absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(new SetCropPhenologyUseCase(repo, audit, clock).execute({ cropId: 'x', actor: 'a', stages: [] }))
      .rejects.toThrow(CropNotFoundError);
  });
});
